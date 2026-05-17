import { persistExportAnimaticVideo } from "../_shared/export-video-persist.ts"
import { extractVideoUrlFromFalData } from "../_shared/fal-video-url.ts"
import { getAdminClient } from "../_shared/admin-client.ts"

const FAL_KEY = Deno.env.get("FAL_KEY") ?? ""

const LUMA_QUEUE_BASE = "https://queue.fal.run/fal-ai/luma-dream-machine"

type TimelineEventRow = {
  id: string
  title: string
  description: string | null
  generated_image_url: string | null
  in_world_time: string | null
  audio_url?: string | null
}

function resolvePublicWebhookTarget(): string | null {
  const raw =
    Deno.env.get("NEXT_PUBLIC_SITE_URL")?.trim() ??
    Deno.env.get("PUBLIC_SITE_URL")?.trim() ??
    ""
  if (!raw) return null
  const base = raw.replace(/\/$/, "")
  return `${base}/api/webhooks/fal`
}

function buildAnimaticPrompt(events: TimelineEventRow[]): string {
  const beats = events.map((e, idx) => {
    const title = e.title?.trim()
    const desc = e.description?.trim()
    const parts = [`Shot ${idx + 1}${title ? `: ${title}` : ""}`]
    if (desc) parts.push(desc)
    return parts.join(" — ")
  })

  const core =
    beats.join(". ") ||
    "Cinematic establishing shots with emotional continuity across the selected timeline."

  const narrationCue = events.some((e) => e.audio_url)
    ? " Leave headroom for narration: measured pacing, readable blocking, gentle camera moves."
    : ""

  return `${core}. Single cohesive cinematic clip, motivated camera motion, consistent lighting, filmic color grading, no subtitles or on-screen text.${narrationCue ? ` ${narrationCue}` : ""}`
}

async function uploadAnimaticManifestJson(
  supabase: ReturnType<typeof getAdminClient>,
  exportId: string,
  manifest: Record<string, unknown>,
): Promise<void> {
  const blob = new Blob([JSON.stringify(manifest, null, 2)], {
    type: "application/json",
  })
  const path = `exports/${exportId}/animatic.json`
  await supabase.storage.from("exports").upload(path, blob, { upsert: true })
}

async function pollLumaVideoUrl(requestId: string): Promise<string | null> {
  const headers = { Authorization: `Key ${FAL_KEY}` }
  const statusUrl = `${LUMA_QUEUE_BASE}/requests/${requestId}/status`
  const resultUrl = `${LUMA_QUEUE_BASE}/requests/${requestId}`
  const maxAttempts = 50

  for (let i = 0; i < maxAttempts; i++) {
    const stRes = await fetch(statusUrl, { headers })
    if (!stRes.ok) return null

    const stJson = (await stRes.json()) as { status?: string }
    const st = stJson.status

    if (st === "FAILED" || st === "ERROR") return null

    if (st === "COMPLETED") {
      const resRes = await fetch(resultUrl, { headers })
      if (!resRes.ok) return null
      const body = await resRes.json()
      return extractVideoUrlFromFalData(body)
    }

    await new Promise((r) => setTimeout(r, 2500))
  }

  return null
}

/**
 * Queues (or completes inline) an animatic clip. Returns `true` when the HTTP
 * worker should **not** mark the export row `done` yet — finalization happens
 * via Fal webhook delivery.
 */
async function processAnimaticVideo(
  exportId: string,
  projectId: string,
  events: TimelineEventRow[],
): Promise<boolean> {
  const supabase = getAdminClient()
  const prompt = buildAnimaticPrompt(events)

  const panels = events.map((e) => ({
    title: e.title,
    description: e.description,
    image_url: e.generated_image_url,
    in_world_time: e.in_world_time,
  }))

  const imageUrl =
    events.map((e) => e.generated_image_url).find((u): u is string => Boolean(u)) ?? undefined

  let requestId: string | null = null

  if (FAL_KEY) {
    const webhookTarget = resolvePublicWebhookTarget()
    const queueUrl = webhookTarget
      ? `${LUMA_QUEUE_BASE}?${new URLSearchParams({ fal_webhook: webhookTarget })}`
      : LUMA_QUEUE_BASE

    try {
      const body: Record<string, unknown> = { prompt }
      if (imageUrl) body.image_url = imageUrl

      const res = await fetch(queueUrl, {
        method: "POST",
        headers: {
          Authorization: `Key ${FAL_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        const json = (await res.json()) as { request_id?: string }
        requestId = json.request_id ?? null
      } else {
        const text = await res.text().catch(() => "")
        console.warn("[processAnimaticVideo] queue submit failed:", res.status, text.slice(0, 500))
      }
    } catch (err) {
      console.warn("[processAnimaticVideo] queue submit threw:", err)
    }
  }

  const manifest: Record<string, unknown> = {
    type: "animatic_video",
    project_id: projectId,
    prompt,
    fal_request_id: requestId,
    panels,
  }

  await uploadAnimaticManifestJson(supabase, exportId, manifest)

  if (requestId) {
    await supabase.from("exports").update({ fal_request_id: requestId }).eq("id", exportId)

    if (resolvePublicWebhookTarget()) {
      return true
    }

    const videoUrl = await pollLumaVideoUrl(requestId)

    if (videoUrl) {
      const persisted = await persistExportAnimaticVideo(supabase, exportId, videoUrl)
      if (!persisted) {
        await supabase
          .from("exports")
          .update({ status: "error", fal_request_id: null })
          .eq("id", exportId)
      }
      return false
    }

    await supabase.from("exports").update({ status: "error", fal_request_id: null }).eq("id", exportId)
    return false
  }

  const path = `exports/${exportId}/animatic.json`
  const { data: signed } = await supabase.storage
    .from("exports")
    .createSignedUrl(path, 60 * 60 * 24)

  await supabase
    .from("exports")
    .update({
      output_url: signed?.signedUrl ?? path,
      fal_request_id: null,
      status: "done",
    })
    .eq("id", exportId)

  return false
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
    const { data: exportRow } = await supabase.from("exports").select("*").eq("id", export_id).single()

    if (!exportRow) throw new Error("Export not found")

    const { data: events } = await supabase
      .from("timeline_events")
      .select("id, title, description, generated_image_url, in_world_time, audio_url")
      .in("id", exportRow.event_ids)
      .order("sequence_order")

    let deferTerminalStatus = false

    if (exportRow.type === "storyboard_pdf") {
      await processStoryboardPdf(export_id, exportRow.project_id, events ?? [])
    } else if (exportRow.type === "audio_script") {
      await processAudioScript(export_id, exportRow.project_id, events ?? [])
    } else if (exportRow.type === "animatic_video") {
      deferTerminalStatus = await processAnimaticVideo(export_id, exportRow.project_id, events ?? [])
    }

    if (!deferTerminalStatus) {
      const { data: latest } = await supabase
        .from("exports")
        .select("status")
        .eq("id", export_id)
        .maybeSingle()

      if (latest?.status === "processing") {
        await supabase.from("exports").update({ status: "done" }).eq("id", export_id)
      }
    }
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
        const json = (await res.json()) as { audio?: { url?: string } }
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

          await supabase.from("timeline_events").update({ audio_url: persistedUrl }).eq("id", event.id)

          audioUrls.push(persistedUrl)
        } else {
          // Fall back to direct fal URL
          await supabase.from("timeline_events").update({ audio_url: audioUrl }).eq("id", event.id)
          audioUrls.push(audioUrl)
        }
      } catch {
        // Fall back to direct fal URL on any storage error
        await supabase.from("timeline_events").update({ audio_url: audioUrl }).eq("id", event.id)
        audioUrls.push(audioUrl)
      }
    }
  }

  await supabase.from("exports").update({ output_url: JSON.stringify(audioUrls) }).eq("id", exportId)
}
