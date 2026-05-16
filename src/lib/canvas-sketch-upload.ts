import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db";

const DATA_URL_RE = /^data:image\/(\w+);base64,(.+)$/;

/** Upload a canvas sketch data URL to project storage; returns a public URL for Fal. */
export async function uploadCanvasSketchDataUrl(
  supabase: SupabaseClient<Database>,
  projectId: string,
  dataUrl: string,
): Promise<string | null> {
  const match = DATA_URL_RE.exec(dataUrl.trim());
  if (!match) return null;

  const ext = match[1] === "jpeg" ? "jpg" : match[1];
  const buffer = Buffer.from(match[2], "base64");
  const path = `canvas/${projectId}/sketch-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("images")
    .upload(path, buffer, {
      contentType: `image/${match[1]}`,
      upsert: true,
    });

  if (uploadError) {
    console.warn("Canvas sketch upload failed:", uploadError.message);
    return null;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("images").getPublicUrl(path);

  return publicUrl;
}
