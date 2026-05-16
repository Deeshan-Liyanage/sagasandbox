import { NextResponse } from "next/server";
import { isAuthError, jsonError, requireAuth } from "@/lib/api-auth";
import { mergeCanvasStateForPersist } from "@/lib/canvas-state";
import type { Json } from "@/types/db";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  const { supabase } = auth;
  const { id } = await context.params;

  try {
    const body = (await request.json()) as { canvas_state: Record<string, unknown> };

    if (!body.canvas_state) {
      return NextResponse.json(
        { error: "canvas_state is required" },
        { status: 400 },
      );
    }

    const { data: existing } = await supabase
      .from("projects")
      .select("canvas_state")
      .eq("id", id)
      .single();

    const merged = mergeCanvasStateForPersist(
      existing?.canvas_state as Record<string, unknown> | null,
      body.canvas_state,
    );

    const { error } = await supabase
      .from("projects")
      .update({ canvas_state: merged as Json })
      .eq("id", id);

    if (error) return jsonError(error.message);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Unknown error");
  }
}
