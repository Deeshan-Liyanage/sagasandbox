import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db";

export async function captureProjectSnapshot(
  supabase: SupabaseClient<Database>,
  projectId: string,
  changeDescription?: string,
) {
  const [{ data: project }, { data: pins }, { data: events }, { data: characters }] =
    await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).single(),
      supabase.from("location_pins").select("*").eq("project_id", projectId),
      supabase
        .from("timeline_events")
        .select("*")
        .eq("project_id", projectId)
        .order("sequence_order"),
      supabase.from("characters").select("*").eq("project_id", projectId),
    ]);

  if (!project) return null;

  const state_blob = {
    project,
    pins: pins ?? [],
    events: events ?? [],
    characters: characters ?? [],
  };

  const { data, error } = await supabase
    .from("project_snapshots")
    .insert({
      project_id: projectId,
      state_blob,
      change_description: changeDescription ?? "Auto snapshot",
    })
    .select("id")
    .single();

  if (error) {
    console.warn("snapshot capture failed", error.message);
    return null;
  }

  return data.id;
}
