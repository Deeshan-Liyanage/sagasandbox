import { NextResponse } from "next/server";
import { isAuthError, jsonError, requireAuth } from "@/lib/api-auth";
import { falQueue, projectStyleConfig } from "@/lib/fal";
import type { Database } from "@/types/db";

type PinUpdate = Database["public"]["Tables"]["location_pins"]["Update"];

type RouteContext = { params: Promise<{ id: string; pinId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  const { supabase } = auth;
  const { id: projectId, pinId } = await context.params;

  try {
    const body = (await request.json()) as {
      label?: string;
      description?: string;
    };

    const { data: existing } = await supabase
      .from("location_pins")
      .select("*")
      .eq("id", pinId)
      .eq("project_id", projectId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Pin not found" }, { status: 404 });
    }

    const updates: PinUpdate = {};
    if (body.label !== undefined) updates.label = body.label;
    if (body.description !== undefined) updates.description = body.description;

    const descriptionChanged =
      body.description !== undefined && body.description !== existing.description;

    const { data: pin, error } = await supabase
      .from("location_pins")
      .update(updates)
      .eq("id", pinId)
      .select()
      .single();

    if (error || !pin) return jsonError(error?.message ?? "Update failed");

    if (descriptionChanged) {
      const { data: project } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();

      if (project) {
        const styleConfig = projectStyleConfig(project);
        const prompt = `${styleConfig.aesthetic_style} ${styleConfig.tone} location: ${pin.label}. ${pin.description ?? ""}`;
        try {
          const result = await falQueue({ prompt, model: "fal-ai/flux/dev" });
          if (result) {
            const updatePayload: Record<string, string> = {
              gen_status: result.imageUrl ? "done" : "generating",
              fal_request_id: result.requestId,
            };
            if (result.imageUrl) {
              updatePayload.generated_image_url = result.imageUrl;
            }
            const { data: updated } = await supabase
              .from("location_pins")
              .update(updatePayload)
              .eq("id", pinId)
              .select()
              .single();
            return NextResponse.json({ pin: updated ?? pin });
          }
        } catch (falErr) {
          console.error("[pins PATCH] falQueue failed:", falErr);
          // keep updated pin without regen
        }
      }
    }

    return NextResponse.json({ pin });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Unknown error");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  const { supabase } = auth;
  const { id: projectId, pinId } = await context.params;

  try {
    const { error: deleteError } = await supabase
      .from("location_pins")
      .delete()
      .eq("id", pinId)
      .eq("project_id", projectId);

    if (deleteError) return jsonError(deleteError.message);

    await supabase
      .from("timeline_events")
      .update({ pin_id: null })
      .eq("pin_id", pinId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Unknown error");
  }
}
