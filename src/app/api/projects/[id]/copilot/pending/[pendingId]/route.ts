import { NextResponse } from "next/server";
import { isAuthError, jsonError, requireAuth } from "@/lib/api-auth";
import { captureProjectSnapshot } from "@/lib/snapshots";

type RouteContext = { params: Promise<{ id: string; pendingId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  const { supabase } = auth;
  const { id: projectId, pendingId } = await context.params;

  try {
    const body = (await request.json()) as { action: "approve" | "reject" };

    const { data: pending, error } = await supabase
      .from("copilot_pending_changes")
      .select("*")
      .eq("id", pendingId)
      .eq("project_id", projectId)
      .single();

    if (error || !pending) {
      return NextResponse.json({ error: "Pending change not found" }, { status: 404 });
    }

    const payload = pending.payload as { event_id?: string };
    let event = null;

    if (body.action === "approve" && payload.event_id) {
      const { data: updated } = await supabase
        .from("timeline_events")
        .update({ is_ghost: false })
        .eq("id", payload.event_id)
        .select()
        .single();
      event = updated;
    } else if (body.action === "reject" && payload.event_id) {
      await supabase.from("timeline_events").delete().eq("id", payload.event_id);
    }

    await supabase
      .from("copilot_pending_changes")
      .update({ status: body.action === "approve" ? "approved" : "rejected" })
      .eq("id", pendingId);

    await captureProjectSnapshot(
      supabase,
      projectId,
      `Copilot ${body.action}`,
    );

    return NextResponse.json({ event, status: body.action });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Unknown error");
  }
}
