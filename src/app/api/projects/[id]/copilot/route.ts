import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import { isAuthError, jsonError, requireAuth } from "@/lib/api-auth";
import { captureProjectSnapshot } from "@/lib/snapshots";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  const { supabase } = auth;
  const { id: projectId } = await context.params;

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY not configured" },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as {
      message: string;
      propose_changes?: boolean;
    };

    if (!body.message?.trim()) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    const [{ data: project }, { data: pins }, { data: events }, { data: characters }] =
      await Promise.all([
        supabase.from("projects").select("*").eq("id", projectId).single(),
        supabase.from("location_pins").select("*").eq("project_id", projectId),
        supabase
          .from("timeline_events")
          .select("*")
          .eq("project_id", projectId)
          .order("sequence_order"),
        supabase.from("characters").select("*").eq("project_id", projectId),
      ]);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const contextBlock = JSON.stringify(
      {
        theme: project.theme,
        aesthetic: project.aesthetic_style,
        pins: (pins ?? []).map((p) => ({
          id: p.id,
          label: p.label,
          description: p.description,
        })),
        events: (events ?? []).map((e) => ({
          id: e.id,
          title: e.title,
          description: e.description,
          sequence_order: e.sequence_order,
          pin_id: e.pin_id,
          is_ghost: e.is_ghost,
        })),
        characters: (characters ?? []).map((c) => ({
          name: c.name,
          description: c.description,
        })),
      },
      null,
      2,
    );

    const result = streamText({
      model: openai("gpt-4o-mini"),
      system: `You are the SagaSandbox Creative Copilot. Analyze narrative consistency and plot holes.
When you suggest a new timeline event, append a single line exactly like:
PROPOSE_EVENT: {"title":"...","description":"...","pin_id":null}
Project state JSON:
${contextBlock}`,
      prompt: body.message,
    });

    const text = await result.text;

    let pendingId: string | null = null;
    const proposeMatch = text.match(/PROPOSE_EVENT:\s*(\{[\s\S]*?\})/);
    if (body.propose_changes !== false && proposeMatch) {
      try {
        const payload = JSON.parse(proposeMatch[1]) as {
          title: string;
          description?: string;
          pin_id?: string | null;
        };
        const nextOrder =
          (events ?? []).length > 0
            ? Math.max(...(events ?? []).map((e) => e.sequence_order)) + 1
            : 0;

        const { data: ghost } = await supabase
          .from("timeline_events")
          .insert({
            project_id: projectId,
            title: payload.title,
            description: payload.description ?? null,
            pin_id: payload.pin_id ?? null,
            sequence_order: nextOrder,
            is_ghost: true,
            gen_status: "pending",
          })
          .select()
          .single();

        if (ghost) {
          const { data: pending } = await supabase
            .from("copilot_pending_changes")
            .insert({
              project_id: projectId,
              change_type: "add_event",
              payload: { event_id: ghost.id },
              status: "pending",
            })
            .select("id")
            .single();
          pendingId = pending?.id ?? null;
        }
      } catch {
        // ignore malformed proposal
      }
    }

    const snapshotId = await captureProjectSnapshot(supabase, projectId, "Copilot query");

    await supabase.from("agent_logs").insert({
      project_id: projectId,
      query: body.message,
      response: text,
      action_taken: Boolean(pendingId),
      revert_reference_id: snapshotId,
    });

    return NextResponse.json({
      response: text.replace(/PROPOSE_EVENT:[\s\S]*$/, "").trim(),
      pending_id: pendingId,
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Unknown error");
  }
}
