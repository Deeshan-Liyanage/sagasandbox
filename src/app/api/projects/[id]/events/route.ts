import { NextResponse } from "next/server";
import { isAuthError, jsonError, requireAuth } from "@/lib/api-auth";
import { buildPrompt, falQueue, projectStyleConfig } from "@/lib/fal";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db";
import type { VisualTraits } from "@/types/app";

type EventUpdate = Database["public"]["Tables"]["timeline_events"]["Update"];

type RouteContext = { params: Promise<{ id: string }> };

async function triggerEventGeneration(
  supabase: SupabaseClient<Database>,
  projectId: string,
  event: { id: string; description: string | null; title: string; pin_id: string | null },
) {
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();

  if (!project) return;

  const { data: characters } = await supabase
    .from("characters")
    .select("*")
    .eq("project_id", projectId);

  const description = event.description ?? event.title;
  const matched = (characters ?? []).filter((c) =>
    description.toLowerCase().includes(c.name.toLowerCase()),
  );

  const characterLines = matched.map((c) => {
    const traits = (c.visual_traits ?? {}) as VisualTraits;
    return [c.name, traits.hair, traits.build, traits.clothing, traits.features]
      .filter(Boolean)
      .join(", ");
  });

  const styleConfig = projectStyleConfig(project);
  let imageUrl: string | undefined;

  if (event.pin_id) {
    const { data: pin } = await supabase
      .from("location_pins")
      .select("generated_image_url")
      .eq("id", event.pin_id)
      .single();
    if (pin?.generated_image_url) imageUrl = pin.generated_image_url;
  }

  const refChar = matched.find((c) => c.reference_image_url);
  if (refChar?.reference_image_url) {
    imageUrl = refChar.reference_image_url;
  }

  const prompt = buildPrompt({
    styleConfig,
    description: `scene: ${description}`,
    characters: characterLines.length ? characterLines : undefined,
  });

  const result = await falQueue({
    prompt,
    model: "fal-ai/flux/dev",
    imageUrl,
  });

  if (result) {
    const updatePayload: EventUpdate = {
      gen_status: result.imageUrl ? "done" : "generating",
      fal_request_id: result.requestId,
      ...(result.imageUrl ? { generated_image_url: result.imageUrl } : {}),
    };
    await supabase
      .from("timeline_events")
      .update(updatePayload)
      .eq("id", event.id);
  }
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  const { supabase } = auth;
  const { id } = await context.params;

  try {
    const { data: events, error } = await supabase
      .from("timeline_events")
      .select("*")
      .eq("project_id", id)
      .order("sequence_order", { ascending: true });

    if (error) return jsonError(error.message);

    return NextResponse.json({ events: events ?? [] });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Unknown error");
  }
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  const { supabase } = auth;
  const { id: projectId } = await context.params;

  try {
    const body = (await request.json()) as {
      title: string;
      description?: string;
      sequence_order: number;
      pin_id?: string;
      in_world_time?: string;
      is_ghost?: boolean;
    };

    if (!body.title || body.sequence_order === undefined) {
      return NextResponse.json(
        { error: "title and sequence_order are required" },
        { status: 400 },
      );
    }

    const { data: event, error } = await supabase
      .from("timeline_events")
      .insert({
        project_id: projectId,
        title: body.title,
        description: body.description ?? null,
        sequence_order: body.sequence_order,
        pin_id: body.pin_id ?? null,
        in_world_time: body.in_world_time ?? null,
        is_ghost: body.is_ghost ?? false,
        gen_status: "pending",
      })
      .select()
      .single();

    if (error || !event) return jsonError(error?.message ?? "Insert failed");

    try {
      await triggerEventGeneration(supabase, projectId, event);
      const { data: updated } = await supabase
        .from("timeline_events")
        .select("*")
        .eq("id", event.id)
        .single();
      return NextResponse.json({ event: updated ?? event }, { status: 201 });
    } catch {
      return NextResponse.json({ event }, { status: 201 });
    }
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Unknown error");
  }
}
