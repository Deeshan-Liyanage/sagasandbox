import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

function resolveSupabaseAdminKey() {
  const secretKeysRaw = Deno.env.get("SUPABASE_SECRET_KEYS")
  if (secretKeysRaw) {
    try {
      const secretKeys = JSON.parse(secretKeysRaw) as Record<string, string>
      if (secretKeys.default) return secretKeys.default
    } catch {
      // Fall through to single-key env vars.
    }
  }

  return (
    Deno.env.get("SUPABASE_SECRET_KEY") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_SB_KEY")
  )
}

const adminKey = resolveSupabaseAdminKey()
if (!adminKey) {
  throw new Error(
    "Missing Supabase admin key (SUPABASE_SECRET_KEYS, SUPABASE_SECRET_KEY, or SUPABASE_SERVICE_ROLE_KEY)",
  )
}

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, adminKey)

type TimelineEventRow = {
  id: string
  title: string
  description: string | null
  generated_image_url: string | null
  in_world_time: string | null
  characters?: Array<{ voice_id: string | null }>
}

Deno.serve(async (req) => {
  const { export_id } = await req.json()

  await supabase.from("exports").update({ status: "processing" }).eq("id", export_id)

  try {
    const { data: exportRow } = await supabase
      .from("exports")
      .select("*")
      .eq("id", export_id)
      .single()

    if (!exportRow) throw new Error("Export not found")

    const { data: events } = await supabase
      .from("timeline_events")
      .select("id, title, description, generated_image_url, in_world_time")
      .in("id", exportRow.event_ids)
      .order("sequence_order")

    if (exportRow.type === "storyboard_pdf") {
      await processStoryboardPdf(export_id, exportRow.project_id, events ?? [])
    } else if (exportRow.type === "audio_script") {
      await processAudioScript(export_id, events ?? [])
    }

    await supabase.from("exports").update({ status: "done" }).eq("id", export_id)
  } catch (err) {
    console.error(err)
    await supabase.from("exports").update({ status: "error" }).eq("id", export_id)
  }

  return Response.json({ ok: true })
})

async function processStoryboardPdf(
  exportId: string,
  projectId: string,
  events: TimelineEventRow[],
) {
  const manifest = {
    type: "storyboard",
    project_id: projectId,
    panels: events.map((e) => ({
      title: e.title,
      description: e.description,
      image_url: e.generated_image_url,
      in_world_time: e.in_world_time,
    })),
  }

  const blob = new Blob([JSON.stringify(manifest, null, 2)], {
    type: "application/json",
  })
  const path = `exports/${exportId}/storyboard.json`

  await supabase.storage.from("exports").upload(path, blob, { upsert: true })

  const { data: signed } = await supabase.storage
    .from("exports")
    .createSignedUrl(path, 60 * 60 * 24)

  await supabase
    .from("exports")
    .update({ output_url: signed?.signedUrl ?? path })
    .eq("id", exportId)
}

async function processAudioScript(exportId: string, events: TimelineEventRow[]) {
  const elevenLabsKey = Deno.env.get("ELEVENLABS_API_KEY")
  const defaultVoice =
    Deno.env.get("ELEVENLABS_DEFAULT_VOICE_ID") ?? "pNInz6obpgDQGcFmaJgB"
  const audioUrls: string[] = []

  for (const event of events) {
    await new Promise((r) => setTimeout(r, 500))

    const voiceId = event.characters?.[0]?.voice_id ?? defaultVoice
    const text = event.description ?? event.title

    let attempt = 0
    let audioBuffer: ArrayBuffer | null = null

    while (attempt < 3 && !audioBuffer && elevenLabsKey) {
      try {
        const res = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
          {
            method: "POST",
            headers: {
              "xi-api-key": elevenLabsKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text,
              model_id: "eleven_monolingual_v1",
              voice_settings: { stability: 0.5, similarity_boost: 0.75 },
            }),
          },
        )

        if (res.ok) {
          audioBuffer = await res.arrayBuffer()
        } else {
          await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt))
          attempt++
        }
      } catch {
        attempt++
      }
    }

    if (audioBuffer) {
      const path = `audio/${exportId}/${event.id}.mp3`
      await supabase.storage.from("audio").upload(path, audioBuffer, {
        contentType: "audio/mpeg",
        upsert: true,
      })
      const { data: url } = supabase.storage.from("audio").getPublicUrl(path)
      audioUrls.push(url.publicUrl)

      await supabase
        .from("timeline_events")
        .update({ audio_url: url.publicUrl })
        .eq("id", event.id)
    }
  }

  await supabase
    .from("exports")
    .update({ output_url: JSON.stringify(audioUrls) })
    .eq("id", exportId)
}
