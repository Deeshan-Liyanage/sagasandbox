import { NextResponse } from "next/server";
import { isAuthError, jsonError, requireAuth } from "@/lib/api-auth";
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

    const { error } = await supabase
      .from("projects")
      .update({ canvas_state: body.canvas_state as Json })
      .eq("id", id);

    if (error) return jsonError(error.message);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Unknown error");
  }
}
