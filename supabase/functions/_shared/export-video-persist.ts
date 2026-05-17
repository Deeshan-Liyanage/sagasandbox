import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"

/**
 * Downloads the Fal-hosted clip and persists it under `exports/{exportId}/animatic.mp4`,
 * then marks the export row complete (clears `fal_request_id`).
 */
export async function persistExportAnimaticVideo(
  supabase: SupabaseClient,
  exportId: string,
  videoUrl: string,
): Promise<boolean> {
  try {
    const vidResponse = await fetch(videoUrl)
    if (!vidResponse.ok) {
      console.error(
        "[persistExportAnimaticVideo] download failed",
        vidResponse.status,
        videoUrl.slice(0, 120),
      )
      return false
    }

    const buffer = await vidResponse.arrayBuffer()
    const path = `exports/${exportId}/animatic.mp4`

    const { error: uploadError } = await supabase.storage.from("exports").upload(path, buffer, {
      contentType: "video/mp4",
      upsert: true,
    })

    if (uploadError) {
      console.error("[persistExportAnimaticVideo] upload failed:", uploadError.message)
      return false
    }

    const { data: signed } = await supabase.storage
      .from("exports")
      .createSignedUrl(path, 60 * 60 * 24)

    const { error: updateError } = await supabase
      .from("exports")
      .update({
        output_url: signed?.signedUrl ?? path,
        fal_request_id: null,
        status: "done",
      })
      .eq("id", exportId)

    if (updateError) {
      console.error("[persistExportAnimaticVideo] exports update failed:", updateError.message)
      return false
    }

    return true
  } catch (err) {
    console.error("[persistExportAnimaticVideo]", err)
    return false
  }
}
