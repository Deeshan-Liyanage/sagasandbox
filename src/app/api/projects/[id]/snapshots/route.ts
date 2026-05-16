import { NextResponse } from "next/server";
import { isAuthError, jsonError, requireAuth } from "@/lib/api-auth";
import { captureProjectSnapshot } from "@/lib/snapshots";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  const { supabase } = auth;
  const { id } = await context.params;

  try {
    const { data, error } = await supabase
      .from("project_snapshots")
      .select("id, change_description, created_at")
      .eq("project_id", id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) return jsonError(error.message);
    return NextResponse.json({ snapshots: data ?? [] });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Unknown error");
  }
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  const { supabase } = auth;
  const { id } = await context.params;

  try {
    const body = (await request.json().catch(() => ({}))) as {
      change_description?: string;
    };
    const snapshotId = await captureProjectSnapshot(
      supabase,
      id,
      body.change_description,
    );
    if (!snapshotId) {
      return NextResponse.json({ error: "Snapshot failed" }, { status: 500 });
    }
    return NextResponse.json({ snapshot_id: snapshotId }, { status: 201 });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Unknown error");
  }
}
