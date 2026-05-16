import { NextResponse } from "next/server";
import { isAuthError, jsonError, requireAuth } from "@/lib/api-auth";
import { falQueue, projectStyleConfig } from "@/lib/fal";
import type { VisualTraits } from "@/types/app";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  const { supabase } = auth;
  const { id } = await context.params;

  try {
    const { data: characters, error } = await supabase
      .from("characters")
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: true });

    if (error) return jsonError(error.message);

    return NextResponse.json({ characters: characters ?? [] });
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
      name: string;
      role?: "primary" | "secondary";
      description?: string;
      visual_traits: VisualTraits;
    };

    if (!body.name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const { data: character, error } = await supabase
      .from("characters")
      .insert({
        project_id: projectId,
        name: body.name,
        role: body.role ?? null,
        description: body.description ?? null,
        visual_traits: body.visual_traits ?? {},
      })
      .select()
      .single();

    if (error || !character) return jsonError(error?.message ?? "Insert failed");

    const traits = body.visual_traits ?? {};
    const styleConfig = projectStyleConfig(project);
    const prompt = `${styleConfig.aesthetic_style} character portrait: ${body.description ?? body.name}. Appearance: ${traits.hair ?? ""} hair, ${traits.build ?? ""} build, wearing ${traits.clothing ?? ""}. ${traits.features ?? ""}`;

    try {
      const result = await falQueue({ prompt, model: "fal-ai/flux/dev" });
      if (result) {
        const { data: updated } = await supabase
          .from("characters")
          .update({
            gen_status: "generating",
            fal_request_id: result.requestId,
          })
          .eq("id", character.id)
          .select()
          .single();
        return NextResponse.json({ character: updated ?? character }, { status: 201 });
      }
    } catch {
      // fal may be unavailable during local dev
    }

    return NextResponse.json({ character }, { status: 201 });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Unknown error");
  }
}
