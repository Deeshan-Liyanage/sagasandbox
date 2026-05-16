import { NextResponse } from "next/server";
import { isAuthError, jsonError, requireAuth } from "@/lib/api-auth";
import { falWhisperTranscribe } from "@/lib/fal-media";

type RouteContext = { params: Promise<{ id: string; evId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  const { supabase } = auth;
  const { id: projectId, evId } = await context.params;

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    const path = `${projectId}/events/${evId}/voice.webm`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from("audio")
      .upload(path, buffer, {
        contentType: file.type || "audio/webm",
        upsert: true,
      });

    if (uploadError) return jsonError(uploadError.message);

    const {
      data: { publicUrl },
    } = supabase.storage.from("audio").getPublicUrl(path);

    const audioSummary = await falWhisperTranscribe(publicUrl);

    const { data: event, error } = await supabase
      .from("timeline_events")
      .update({
        audio_url: publicUrl,
        audio_summary: audioSummary,
        description: audioSummary ?? undefined,
      })
      .eq("id", evId)
      .eq("project_id", projectId)
      .select()
      .single();

    if (error || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    return NextResponse.json({ event, audio_summary: audioSummary });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Unknown error");
  }
}
