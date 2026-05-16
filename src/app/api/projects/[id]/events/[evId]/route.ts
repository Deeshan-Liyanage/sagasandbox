import { NextResponse } from "next/server";
import { isAuthError, jsonError, requireAuth } from "@/lib/api-auth";
import { buildPrompt, falQueue, projectStyleConfig } from "@/lib/fal";
import type { VisualTraits } from "@/types/app";
import type { Database } from "@/types/db";

type EventUpdate = Database["public"]["Tables"]["timeline_events"]["Update"];

type RouteContext = { params: Promise<{ id: string; evId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  const { supabase } = auth;
  const { id: projectId, evId } = await context.params;

  try {
    const body = (await request.json()) as {
      title?: string;
      description?: string;
      sequence_order?: number;
      pin_id?: string | null;
      in_world_time?: string;
      is_ghost?: boolean;
      audio_summary?: string;
    };

    const { data: existing } = await supabase
      .from("timeline_events")
      .select("*")
      .eq("id", evId)
      .eq("project_id", projectId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const updates: EventUpdate = {};
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.sequence_order !== undefined) updates.sequence_order = body.sequence_order;
    if (body.pin_id !== undefined) updates.pin_id = body.pin_id;
    if (body.in_world_time !== undefined) updates.in_world_time = body.in_world_time;
    if (body.is_ghost !== undefined) updates.is_ghost = body.is_ghost;
    if (body.audio_summary !== undefined) updates.audio_summary = body.audio_summary;

    const descriptionChanged =
      body.description !== undefined && body.description !== existing.description;

    const { data: event, error } = await supabase
      .from("timeline_events")
      .update(updates)
      .eq("id", evId)
      .select()
      .single();

    if (error || !event) return jsonError(error?.message ?? "Update failed");

    if (descriptionChanged) {
      const { data: project } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();

      if (project) {
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

        try {
          const result = await falQueue({
            prompt,
            model: "fal-ai/flux/dev",
            imageUrl,
          });
          if (result) {
            const { data: updated } = await supabase
              .from("timeline_events")
              .update({
                gen_status: "generating",
                fal_request_id: result.requestId,
              })
              .eq("id", evId)
              .select()
              .single();
            return NextResponse.json({ event: updated ?? event });
          }
        } catch {
          // keep event without regen
        }
      }
    }

    return NextResponse.json({ event });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Unknown error");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  const { supabase } = auth;
  const { id: projectId, evId } = await context.params;

  try {
    const { error } = await supabase
      .from("timeline_events")
      .delete()
      .eq("id", evId)
      .eq("project_id", projectId);

    if (error) return jsonError(error.message);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Unknown error");
  }
}
