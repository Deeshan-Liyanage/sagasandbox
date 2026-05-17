import { NextResponse } from "next/server";
import { isAuthError, jsonError, requireAuth } from "@/lib/api-auth";
type RouteContext = { params: Promise<{ id: string; snapshotId: string }> };

type SnapshotState = {
  project?: Record<string, unknown>;
  pins?: Array<Record<string, unknown>>;
  events?: Array<Record<string, unknown>>;
  characters?: Array<Record<string, unknown>>;
};

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  const { supabase } = auth;
  const { id: projectId, snapshotId } = await context.params;

  try {
    const { data: snapshot, error } = await supabase
      .from("project_snapshots")
      .select("state_blob")
      .eq("id", snapshotId)
      .eq("project_id", projectId)
      .single();

    if (error || !snapshot) {
      return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });
    }

    const state = snapshot.state_blob as SnapshotState;

    if (state.project) {
      const p = state.project;
      await supabase
        .from("projects")
        .update({
          name: typeof p.name === "string" ? p.name : undefined,
          theme: typeof p.theme === "string" ? p.theme : undefined,
          aesthetic_style:
            typeof p.aesthetic_style === "string" ? p.aesthetic_style : undefined,
          style_config: p.style_config as never,
          canvas_state: p.canvas_state as never,
        })
        .eq("id", projectId);
    }

    await supabase.from("location_pins").delete().eq("project_id", projectId);
    await supabase.from("timeline_events").delete().eq("project_id", projectId);
    await supabase.from("characters").delete().eq("project_id", projectId);

    if (state.pins?.length) {
      await supabase.from("location_pins").insert(
        state.pins.map((p) => {
          const row = { ...(p as Record<string, unknown>) };
          delete row.project_id;
          return { ...row, project_id: projectId };
        }) as never,
      );
    }

    if (state.events?.length) {
      await supabase.from("timeline_events").insert(
        state.events.map((e) => {
          const row = { ...(e as Record<string, unknown>) };
          delete row.project_id;
          return { ...row, project_id: projectId };
        }) as never,
      );
    }

    if (state.characters?.length) {
      await supabase.from("characters").insert(
        state.characters.map((c) => {
          const row = { ...(c as Record<string, unknown>) };
          delete row.project_id;
          return { ...row, project_id: projectId };
        }) as never,
      );
    }

    const { data: project } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    return NextResponse.json({
      ok: true,
      project,
      restored: {
        pins: state.pins?.length ?? 0,
        events: state.events?.length ?? 0,
        characters: state.characters?.length ?? 0,
      },
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Unknown error");
  }
}
