import { getAdminClient } from "../_shared/admin-client.ts"

const FAL_KEY = Deno.env.get("FAL_KEY") ?? ""

type TimelineEventRow = {
  id: string
  title: string
  description: string | null
  generated_image_url: string | null
  in_world_time: string | null
}

Deno.serve(async (req) => {
  let supabase
  try {
    supabase = getAdminClient()
  } catch (err) {
    console.error("[process-export] init failed:", err)
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }

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
      await processAudioScript(export_id, exportRow.project_id, events ?? [])
    } else if (exportRow.type === "animatic_video") {
      await processAnimaticVideo(export_id, exportRow.project_id, events ?? [])
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
  const supabase = getAdminClient()
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

/** Voices from fal-ai/kokoro — keep in sync with CharacterVault KOKORO_VOICES. */
const KOKORO_VOICES = [
  "af_heart",
  "af_bella",
  "af_nova",
  "af_sarah",
  "af_river",
  "am_echo",
  "am_eric",
  "am_michael",
  "am_adam",
] as const

const NARRATOR_VOICES = ["am_echo", "am_eric", "am_michael", "af_sarah", "af_nova"]

function isKokoroVoice(voice: string): boolean {
  return (KOKORO_VOICES as readonly string[]).includes(voice)
}

async function kokoro(text: string, voiceIndex: number, voiceOverride?: string): Promise<string | null> {
  if (!FAL_KEY) {
    console.warn("FAL_KEY not set — skipping TTS for event")
    return null
  }

  const voice = voiceOverride ?? NARRATOR_VOICES[voiceIndex % NARRATOR_VOICES.length]

  let attempt = 0
  while (attempt < 3) {
    try {
      const res = await fetch("https://fal.run/fal-ai/kokoro", {
        method: "POST",
        headers: {
          Authorization: `Key ${FAL_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: text, voice, speed: 0.95 }),
      })

      if (res.ok) {
        const json = await res.json() as { audio?: { url?: string } }
        return json.audio?.url ?? null
      }

      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt))
      attempt++
    } catch {
      attempt++
    }
  }

  return null
}

async function processAudioScript(exportId: string, projectId: string, events: TimelineEventRow[]) {
  const supabase = getAdminClient()
  // Build a name→voice map from characters in this project so voice_id
  // (a Kokoro voice name) can be resolved per-event by character mention.
  const { data: characters } = await supabase
    .from("characters")
    .select("name, voice_id")
    .eq("project_id", projectId)

  const voiceMap = new Map<string, string>()
  for (const c of characters ?? []) {
    if (c.voice_id) voiceMap.set(c.name.toLowerCase(), c.voice_id)
  }

  const audioUrls: string[] = []

  for (let i = 0; i < events.length; i++) {
    const event = events[i]
    const text = event.description ?? event.title

    // Resolve Kokoro voice: first character mentioned in text wins, else rotate.
    const matchedVoice = [...voiceMap.entries()]
      .find(([name]) => text.toLowerCase().includes(name))?.[1]
    const voiceOverride =
      matchedVoice && isKokoroVoice(matchedVoice) ? matchedVoice : undefined

    // 500 ms gap between calls to stay within rate limits
    if (i > 0) await new Promise((r) => setTimeout(r, 500))

    const audioUrl = await kokoro(text, i, voiceOverride)

    if (audioUrl) {
      // Download from fal CDN and persist in Supabase Storage so the URL
      // does not expire (fal temp URLs last ~1 hour).
      try {
        const audioRes = await fetch(audioUrl)
        if (audioRes.ok) {
          const buffer = await audioRes.arrayBuffer()
          const path = `audio/${exportId}/${event.id}.wav`
          await supabase.storage.from("audio").upload(path, buffer, {
            contentType: "audio/wav",
            upsert: true,
          })
          const { data: url } = supabase.storage.from("audio").getPublicUrl(path)
          const persistedUrl = url.publicUrl

          await supabase
            .from("timeline_events")
            .update({ audio_url: persistedUrl })
            .eq("id", event.id)

          audioUrls.push(persistedUrl)
        } else {
          // Fall back to direct fal URL
          await supabase
            .from("timeline_events")
            .update({ audio_url: audioUrl })
            .eq("id", event.id)
          audioUrls.push(audioUrl)
        }
      } catch {
        // Fall back to direct fal URL on any storage error
        await supabase
          .from("timeline_events")
          .update({ audio_url: audioUrl })
          .eq("id", event.id)
        audioUrls.push(audioUrl)
      }
    }
  }

  await supabase
    .from("exports")
    .update({ output_url: JSON.stringify(audioUrls) })
    .eq("id", exportId)
}

async function processAnimaticVideo(
  exportId: string,
  projectId: string,
  events: TimelineEventRow[],
) {
  const supabase = getAdminClient()
  const prompt =
    events.map((e) => e.description ?? e.title).filter(Boolean).join(". ") ||
    "Cinematic story animatic"

  let videoJobUrl: string | null = null
  if (FAL_KEY) {
    const imageUrl = events.find((e) => e.generated_image_url)?.generated_image_url
    try {
      const body: Record<string, unknown> = { prompt }
      if (imageUrl) body.image_url = imageUrl
      const res = await fetch("https://queue.fal.run/fal-ai/luma-dream-machine", {
        method: "POST",
        headers: {
          Authorization: `Key ${FAL_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        const json = await res.json() as { request_id?: string }
        videoJobUrl = json.request_id
          ? `https://queue.fal.run/fal-ai/luma-dream-machine/requests/${json.request_id}`
          : null
      }
    } catch {
      // keep manifest-only fallback
    }
  }

  const manifest = {
    type: "animatic_video",
    project_id: projectId,
    prompt,
    video_job_url: videoJobUrl,
    panels: events.map((e) => ({
      title: e.title,
      image_url: e.generated_image_url,
    })),
  }

  const blob = new Blob([JSON.stringify(manifest, null, 2)], {
    type: "application/json",
  })
  const path = `exports/${exportId}/animatic.json`

  await supabase.storage.from("exports").upload(path, blob, { upsert: true })
  const { data: signed } = await supabase.storage
    .from("exports")
    .createSignedUrl(path, 60 * 60 * 24)

  await supabase
    .from("exports")
    .update({ output_url: signed?.signedUrl ?? path })
    .eq("id", exportId)
}
