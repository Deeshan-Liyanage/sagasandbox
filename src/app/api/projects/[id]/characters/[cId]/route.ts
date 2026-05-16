import { NextResponse } from "next/server";
import { isAuthError, jsonError, requireAuth } from "@/lib/api-auth";
import { falQueue, projectStyleConfig } from "@/lib/fal";
import type { VisualTraits } from "@/types/app";
import type { Database } from "@/types/db";

type CharacterUpdate = Database["public"]["Tables"]["characters"]["Update"];

type RouteContext = { params: Promise<{ id: string; cId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  const { supabase } = auth;
  const { id: projectId, cId } = await context.params;

  try {
    const body = (await request.json()) as {
      name?: string;
      role?: "primary" | "secondary";
      description?: string;
      visual_traits?: VisualTraits;
      voice_id?: string;
    };

    const { data: existing } = await supabase
      .from("characters")
      .select("*")
      .eq("id", cId)
      .eq("project_id", projectId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Character not found" }, { status: 404 });
    }

    const updates: CharacterUpdate = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.role !== undefined) updates.role = body.role;
    if (body.description !== undefined) updates.description = body.description;
    if (body.visual_traits !== undefined)
      updates.visual_traits = body.visual_traits as CharacterUpdate["visual_traits"];
    if (body.voice_id !== undefined) updates.voice_id = body.voice_id;

    const visualChanged =
      body.visual_traits !== undefined ||
      (body.description !== undefined && body.description !== existing.description);

    const { data: character, error } = await supabase
      .from("characters")
      .update(updates)
      .eq("id", cId)
      .select()
      .single();

    if (error || !character) return jsonError(error?.message ?? "Update failed");

    if (visualChanged) {
      const { data: project } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();

      if (project) {
        const traits = (character.visual_traits ?? {}) as VisualTraits;
        const styleConfig = projectStyleConfig(project);
        const prompt = `${styleConfig.aesthetic_style} character portrait: ${character.description ?? character.name}. Appearance: ${traits.hair ?? ""} hair, ${traits.build ?? ""} build, wearing ${traits.clothing ?? ""}. ${traits.features ?? ""}`;
        try {
          const result = await falQueue({ prompt, model: "fal-ai/flux/dev" });
          if (result) {
            const updatePayload: CharacterUpdate = {
              gen_status: result.imageUrl ? "done" : "generating",
              fal_request_id: result.requestId,
              ...(result.imageUrl ? { generated_portrait_url: result.imageUrl } : {}),
            };
            await supabase.from("characters").update(updatePayload).eq("id", character.id);
          }
        } catch (falErr) {
          console.error("[characters PATCH] falQueue failed:", falErr);
        }
      }
    }

    return NextResponse.json({ character });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Unknown error");
  }
}
