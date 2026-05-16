import { NextResponse } from "next/server";
import { isAuthError, jsonError, requireAuth } from "@/lib/api-auth";
import { pollAndCompleteScenery } from "@/lib/scenery-synthesis";

type RouteContext = { params: Promise<{ id: string }> };

/** Poll Fal queue and persist scenery preview when webhook is unavailable. */
export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  const { supabase } = auth;
  const { id: projectId } = await context.params;

  try {
    const { data: project } = await supabase
      .from("projects")
      .select("canvas_state")
      .eq("id", projectId)
      .single();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const result = await pollAndCompleteScenery(
      supabase,
      projectId,
      project.canvas_state as Record<string, unknown> | null,
    );

    return NextResponse.json(result);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Unknown error");
  }
}
