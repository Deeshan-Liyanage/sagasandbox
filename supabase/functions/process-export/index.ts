import { persistExportAnimaticVideo } from "../_shared/export-video-persist.ts"
import { extractVideoUrlFromFalData } from "../_shared/fal-video-url.ts"
import { getAdminClient } from "../_shared/admin-client.ts"

const FAL_KEY = Deno.env.get("FAL_KEY") ?? ""

const LUMA_TEXT_TO_VIDEO_BASE = "https://queue.fal.run/fal-ai/luma-dream-machine"
const LUMA_IMAGE_TO_VIDEO_BASE =
  "https://queue.fal.run/fal-ai/luma-dream-machine/image-to-video"

type TimelineEventRow = {
  id: string
  title: string
  description: string | null
  generated_image_url: string | null
  in_world_time: string | null
  audio_url?: string | null
}

type AdminClient = ReturnType<typeof getAdminClient>

function resolvePublicWebhookTarget(): string | null {
  const raw =
    Deno.env.get("NEXT_PUBLIC_SITE_URL")?.trim() ??
    Deno.env.get("PUBLIC_SITE_URL")?.trim() ??
    ""
  if (!raw) return null
  if (!/^https:\/\//i.test(raw)) return null
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
  supabase: AdminClient,
  exportId: string,
  manifest: Record<string, unknown>,
): Promise<{ path: string; uploadError: string | null }> {
  const blob = new Blob([JSON.stringify(manifest, null, 2)], {
    type: "application/json",
  })
  const path = `exports/${exportId}/animatic.json`
  const { error } = await supabase.storage
    .from("exports")
    .upload(path, blob, { upsert: true, contentType: "application/json" })
  return { path, uploadError: error?.message ?? null }
}

async function trySignedUrl(
  supabase: AdminClient,
  path: string,
): Promise<string> {
  try {
    const { data: signed } = await supabase.storage
      .from("exports")
      .createSignedUrl(path, 60 * 60 * 24)
    return signed?.signedUrl ?? path
  } catch {
    return path
  }
}

async function setExportError(
  supabase: AdminClient,
  exportId: string,
  message: string,
  partialOutputUrl?: string | null,
): Promise<void> {
  const update: Record<string, unknown> = {
    status: "error",
    error_message: message.slice(0, 1000),
    fal_request_id: null,
  }
  if (partialOutputUrl !== undefined) {
    update.output_url = partialOutputUrl
  }
  await supabase.from("exports").update(update).eq("id", exportId)
}

async function pollLumaVideoUrl(
  base: string,
  requestId: string,
): Promise<{ url: string | null; error: string | null }> {
  const headers = { Authorization: `Key ${FAL_KEY}` }
  const statusUrl = `${base}/requests/${requestId}/status`
  const resultUrl = `${base}/requests/${requestId}`
  const maxAttempts = 50

  for (let i = 0; i < maxAttempts; i++) {
    let stRes: Response
    try {
      stRes = await fetch(statusUrl, { headers })
    } catch (err) {
      return { url: null, error: `Status poll failed: ${String(err)}` }
    }
    if (!stRes.ok) {
      return { url: null, error: `Status poll HTTP ${stRes.status}` }
    }

    const stJson = (await stRes.json().catch(() => ({}))) as { status?: string }
    const st = stJson.status

    if (st === "FAILED" || st === "ERROR") {
      return { url: null, error: `Luma reported ${st}` }
    }

    if (st === "COMPLETED") {
      const resRes = await fetch(resultUrl, { headers })
      if (!resRes.ok) {
        return { url: null, error: `Result fetch HTTP ${resRes.status}` }
      }
      const body = await resRes.json().catch(() => null)
      const url = extractVideoUrlFromFalData(body)
      if (!url) {
        return { url: null, error: "Luma completed but no video URL in payload" }
      }
      return { url, error: null }
    }

    await new Promise((r) => setTimeout(r, 2500))
  }

  return { url: null, error: "Luma polling timed out after ~2 minutes" }
}

/**
 * Queues (or completes inline) an animatic clip. Returns `true` when the HTTP
 * worker should **not** mark the export row `done` yet — finalization happens
 * via Fal webhook delivery or the inline poll path below.
 *
 * Always uploads a JSON manifest as a guaranteed-deliverable artifact, so the
 * user can still download _something_ even when Luma rejects the prompt.
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

  const manifest: Record<string, unknown> = {
    type: "animatic_video",
    project_id: projectId,
    prompt,
    fal_request_id: null,
    panels,
  }

  const { path: manifestPath, uploadError: manifestUploadError } =
    await uploadAnimaticManifestJson(supabase, exportId, manifest)

  if (manifestUploadError) {
    await setExportError(
      supabase,
      exportId,
      `Could not upload export manifest: ${manifestUploadError}`,
      null,
    )
    return false
  }

  const manifestUrl = await trySignedUrl(supabase, manifestPath)

  if (!FAL_KEY) {
    await supabase
      .from("exports")
      .update({
        status: "done",
        output_url: manifestUrl,
        fal_request_id: null,
        error_message:
          "FAL_KEY not configured on edge function — no video was rendered. Manifest is available below.",
      })
      .eq("id", exportId)
    return false
  }

  const queueBase = imageUrl ? LUMA_IMAGE_TO_VIDEO_BASE : LUMA_TEXT_TO_VIDEO_BASE
  const webhookTarget = resolvePublicWebhookTarget()
  const queueUrl = webhookTarget
    ? `${queueBase}?${new URLSearchParams({ fal_webhook: webhookTarget })}`
    : queueBase

  const body: Record<string, unknown> = { prompt }
  if (imageUrl) body.image_url = imageUrl

  let requestId: string | null = null
  let submitError: string | null = null

  try {
    const res = await fetch(queueUrl, {
      method: "POST",
      headers: {
        Authorization: `Key ${FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      const json = (await res.json().catch(() => ({}))) as { request_id?: string }
      requestId = json.request_id ?? null
      if (!requestId) {
        submitError = "Fal accepted the request but returned no request_id"
      }
    } else {
      const text = await res.text().catch(() => "")
      submitError = `Fal queue HTTP ${res.status}: ${text.slice(0, 280) || "(no body)"}`
      console.warn("[processAnimaticVideo] queue submit failed:", submitError)
    }
  } catch (err) {
    submitError = `Fal queue request threw: ${String(err)}`
    console.warn("[processAnimaticVideo]", submitError)
  }

  if (!requestId) {
    await supabase
      .from("exports")
      .update({
        status: "done",
        output_url: manifestUrl,
        fal_request_id: null,
        error_message:
          submitError ??
          "Video render skipped. Manifest JSON is available for download.",
      })
      .eq("id", exportId)
    return false
  }

  await supabase
    .from("exports")
    .update({
      fal_request_id: requestId,
      output_url: manifestUrl,
      error_message: null,
    })
    .eq("id", exportId)

  if (webhookTarget) {
    return true
  }

  // No public webhook configured — poll inline (best-effort within edge fn time budget).
  const { url: videoUrl, error: pollError } = await pollLumaVideoUrl(queueBase, requestId)

  if (!videoUrl) {
    await supabase
      .from("exports")
      .update({
        status: "done",
        output_url: manifestUrl,
        fal_request_id: null,
        error_message:
          pollError ?? "Luma video did not complete — manifest only is available.",
      })
      .eq("id", exportId)
    return false
  }

  const persisted = await persistExportAnimaticVideo(supabase, exportId, videoUrl)
  if (!persisted) {
    await supabase
      .from("exports")
      .update({
        status: "done",
        output_url: manifestUrl,
        fal_request_id: null,
        error_message:
          "Luma rendered the video but Supabase Storage upload failed — manifest only is available.",
      })
      .eq("id", exportId)
  }
  return false
}

Deno.serve(async (req) => {
  let supabase: AdminClient
  try {
    supabase = getAdminClient()
  } catch (err) {
    console.error("[process-export] init failed:", err)
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }

  let export_id: string | undefined
  try {
    const payload = (await req.json()) as { export_id?: string }
    export_id = payload.export_id
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 })
  }
  if (!export_id) {
    return Response.json({ error: "export_id required" }, { status: 400 })
  }

  await supabase
    .from("exports")
    .update({ status: "processing", error_message: null })
    .eq("id", export_id)

  try {
    const { data: exportRow } = await supabase
      .from("exports")
      .select("*")
      .eq("id", export_id)
      .single()

    if (!exportRow) throw new Error("Export row not found after insert")

    const { data: events, error: eventsError } = await supabase
      .from("timeline_events")
      .select("id, title, description, generated_image_url, in_world_time, audio_url")
      .in("id", exportRow.event_ids ?? [])
      .order("sequence_order")

    if (eventsError) {
      throw new Error(`Loading events failed: ${eventsError.message}`)
    }

    let deferTerminalStatus = false

    if (exportRow.type === "storyboard_pdf") {
      await processStoryboardPdf(export_id, exportRow.project_id, events ?? [])
    } else if (exportRow.type === "audio_script") {
      await processAudioScript(export_id, exportRow.project_id, events ?? [])
    } else if (exportRow.type === "animatic_video") {
      deferTerminalStatus = await processAnimaticVideo(
        export_id,
        exportRow.project_id,
        events ?? [],
      )
    } else {
      throw new Error(`Unknown export type: ${exportRow.type}`)
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
    console.error("[process-export]", err)
    await setExportError(
      supabase,
      export_id,
      err instanceof Error ? err.message : String(err),
    )
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

  const { error: uploadError } = await supabase.storage
    .from("exports")
    .upload(path, blob, { upsert: true, contentType: "application/json" })

  if (uploadError) {
    throw new Error(`Storyboard manifest upload failed: ${uploadError.message}`)
  }

  const signedUrl = await trySignedUrl(supabase, path)

  await supabase
    .from("exports")
    .update({ output_url: signedUrl })
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
  const failures: string[] = []

  for (let i = 0; i < events.length; i++) {
    const event = events[i]
    const text = event.description ?? event.title

    const matchedVoice = [...voiceMap.entries()]
      .find(([name]) => text.toLowerCase().includes(name))?.[1]
    const voiceOverride =
      matchedVoice && isKokoroVoice(matchedVoice) ? matchedVoice : undefined

    if (i > 0) await new Promise((r) => setTimeout(r, 500))

    const audioUrl = await kokoro(text, i, voiceOverride)

    if (!audioUrl) {
      failures.push(event.title || event.id)
      continue
    }

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
        await supabase.from("timeline_events").update({ audio_url: audioUrl }).eq("id", event.id)
        audioUrls.push(audioUrl)
      }
    } catch {
      await supabase.from("timeline_events").update({ audio_url: audioUrl }).eq("id", event.id)
      audioUrls.push(audioUrl)
    }
  }

  const update: Record<string, unknown> = {
    output_url: JSON.stringify(audioUrls),
  }
  if (failures.length > 0) {
    update.error_message = `Voice generation failed for ${failures.length} event(s): ${failures.slice(0, 4).join(", ")}${failures.length > 4 ? "…" : ""}`
  }

  await supabase.from("exports").update(update).eq("id", exportId)
}
