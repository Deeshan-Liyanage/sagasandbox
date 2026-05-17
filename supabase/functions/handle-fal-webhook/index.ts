import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

import { persistExportAnimaticVideo } from "../_shared/export-video-persist.ts"
import { extractVideoUrlFromFalData } from "../_shared/fal-video-url.ts"

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

type FalWebhookPayload = {
  request_id?: string
  requestId?: string
  status: string
  payload?: unknown
  output?: unknown
  error?: string
  detail?: string
  message?: string
}

function extractFalErrorMessage(body: FalWebhookPayload): string {
  const candidates = [body.error, body.detail, body.message].filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  )
  if (candidates.length > 0) return candidates[0]
  const payload = body.payload as Record<string, unknown> | undefined
  if (payload && typeof payload === "object") {
    const detail = payload.detail
    if (typeof detail === "string") return detail
    if (Array.isArray(detail)) {
      const first = detail[0] as Record<string, unknown> | undefined
      const msg = first?.msg
      if (typeof msg === "string") return msg
    }
  }
  return "Luma reported an error but did not include a message"
}

function getFalImageUrl(body: FalWebhookPayload): string | null {
  const data = body.payload ?? body.output
  if (!data || typeof data !== "object") return null
  const d = data as {
    images?: Array<{ url?: string }>
    image?: { url?: string }
  }
  return d.images?.[0]?.url ?? d.image?.url ?? null
}

function patchSceneryState(
  state: Record<string, unknown>,
  metaPatch: Record<string, unknown>,
): Record<string, unknown> {
  if (state.stage && typeof state.stage === "object") {
    const prevMeta =
      typeof state.meta === "object" && state.meta !== null
        ? (state.meta as Record<string, unknown>)
        : {}
    return { ...state, meta: { ...prevMeta, ...metaPatch } }
  }
  if (state.className === "Stage") {
    return { ...state, ...metaPatch }
  }
  const prevMeta =
    typeof state.meta === "object" && state.meta !== null
      ? (state.meta as Record<string, unknown>)
      : {}
  return { ...state, meta: { ...prevMeta, ...metaPatch } }
}

async function findSceneryProject(requestId: string) {
  const { data: byMeta } = await supabase
    .from("projects")
    .select("id, canvas_state")
    .filter("canvas_state->meta->>scenery_fal_request_id", "eq", requestId)
    .maybeSingle()

  if (byMeta) return byMeta

  const { data: byRoot } = await supabase
    .from("projects")
    .select("id, canvas_state")
    .filter("canvas_state->>scenery_fal_request_id", "eq", requestId)
    .maybeSingle()

  return byRoot
}

async function markSceneryError(requestId: string) {
  const sceneryProject = await findSceneryProject(requestId)
  if (!sceneryProject?.canvas_state) return

  const raw = sceneryProject.canvas_state as Record<string, unknown>
  const meta =
    typeof raw.meta === "object" && raw.meta !== null
      ? (raw.meta as Record<string, unknown>)
      : raw
  const isTierB = meta.scenery_pipeline_version === 2

  const nextState = patchSceneryState(raw, {
    scenery_preview_url: "error",
    scenery_fal_request_id: null,
    ...(isTierB ? { scenery_pipeline_stage: "error" } : {}),
  })

  await supabase
    .from("projects")
    .update({ canvas_state: nextState })
    .eq("id", sceneryProject.id)
}

Deno.serve(async (req) => {
  try {
    const body = (await req.json()) as FalWebhookPayload
    const request_id = body.request_id ?? body.requestId
    const { status } = body

    if (!request_id) {
      return Response.json({ error: "missing request_id" }, { status: 400 })
    }

    const { data: pin } = await supabase
      .from("location_pins")
      .select("id, gen_status")
      .eq("fal_request_id", request_id)
      .maybeSingle()

    const { data: event } = await supabase
      .from("timeline_events")
      .select("id, gen_status")
      .eq("fal_request_id", request_id)
      .maybeSingle()

    const { data: character } = await supabase
      .from("characters")
      .select("id, gen_status")
      .eq("fal_request_id", request_id)
      .maybeSingle()

    if (status === "ERROR") {
      const errorMessage = extractFalErrorMessage(body)

      if (pin && pin.gen_status !== "done") {
        await supabase
          .from("location_pins")
          .update({ gen_status: "error" })
          .eq("id", pin.id)
      }
      if (event && event.gen_status !== "done") {
        await supabase
          .from("timeline_events")
          .update({ gen_status: "error" })
          .eq("id", event.id)
      }
      if (character && character.gen_status !== "done") {
        await supabase
          .from("characters")
          .update({ gen_status: "error" })
          .eq("id", character.id)
      }

      // For animatic exports we _keep_ the existing output_url (the manifest
      // uploaded by process-export) and downgrade status to `done` so the user
      // can still grab the manifest. Other export types: mark error.
      const { data: exportRow } = await supabase
        .from("exports")
        .select("id, type, output_url")
        .eq("fal_request_id", request_id)
        .maybeSingle()

      if (exportRow) {
        if (exportRow.type === "animatic_video" && exportRow.output_url) {
          await supabase
            .from("exports")
            .update({
              status: "done",
              fal_request_id: null,
              error_message: `Luma render failed: ${errorMessage}. Manifest JSON is available below.`,
            })
            .eq("id", exportRow.id)
        } else {
          await supabase
            .from("exports")
            .update({
              status: "error",
              fal_request_id: null,
              error_message: `Luma: ${errorMessage}`,
            })
            .eq("id", exportRow.id)
        }
      }

      await markSceneryError(request_id)
      return Response.json({ ok: true })
    }

    if (status !== "OK") return Response.json({ ok: true })

    const { data: exportJob } = await supabase
      .from("exports")
      .select("id, status, type")
      .eq("fal_request_id", request_id)
      .maybeSingle()

    if (exportJob?.type === "animatic_video") {
      const videoUrl =
        extractVideoUrlFromFalData(body.payload ?? body.output) ??
        extractVideoUrlFromFalData(body)

      if (!videoUrl) {
        // Keep the manifest available; treat this as a "done with warning".
        await supabase
          .from("exports")
          .update({
            status: "done",
            fal_request_id: null,
            error_message:
              "Luma completed but no video URL was returned. Manifest JSON is available below.",
          })
          .eq("id", exportJob.id)
        return Response.json({ ok: true })
      }

      if (exportJob.status !== "done") {
        const persisted = await persistExportAnimaticVideo(supabase, exportJob.id, videoUrl)
        if (!persisted) {
          await supabase
            .from("exports")
            .update({
              status: "done",
              fal_request_id: null,
              error_message:
                "Luma rendered the video but Supabase Storage upload failed. Manifest JSON is available below.",
            })
            .eq("id", exportJob.id)
          return Response.json({ ok: true })
        }
      }

      return Response.json({ ok: true })
    }

    const imageUrl = getFalImageUrl(body)
    if (!imageUrl) {
      await markSceneryError(request_id)
      return Response.json({ error: "no image url" }, { status: 400 })
    }

    const imgResponse = await fetch(imageUrl)
    if (!imgResponse.ok) {
      await markSceneryError(request_id)
      return Response.json({ error: "failed to download image" }, { status: 502 })
    }

    const blob = await imgResponse.blob()
    const fileName = `generated/${request_id}.jpg`

    await supabase.storage
      .from("images")
      .upload(fileName, blob, { contentType: "image/jpeg", upsert: true })

    const { data: publicUrl } = supabase.storage.from("images").getPublicUrl(fileName)
    const storageUrl = publicUrl.publicUrl

    if (pin && pin.gen_status !== "done") {
      await supabase
        .from("location_pins")
        .update({
          generated_image_url: storageUrl,
          gen_status: "done",
        })
        .eq("id", pin.id)
    }

    if (event && event.gen_status !== "done") {
      await supabase
        .from("timeline_events")
        .update({
          generated_image_url: storageUrl,
          gen_status: "done",
        })
        .eq("id", event.id)
    }

    if (character && character.gen_status !== "done") {
      await supabase
        .from("characters")
        .update({
          generated_portrait_url: storageUrl,
          gen_status: "done",
        })
        .eq("id", character.id)
    }

    const sceneryProject = await findSceneryProject(request_id)

    if (sceneryProject?.canvas_state) {
      const raw = sceneryProject.canvas_state as Record<string, unknown>
      const meta =
        typeof raw.meta === "object" && raw.meta !== null
          ? (raw.meta as Record<string, unknown>)
          : raw
      const isTierB =
        meta.scenery_pipeline_version === 2 &&
        meta.scenery_pipeline_stage === "base"

      const nextState = patchSceneryState(raw, isTierB
        ? {
            scenery_base_map_url: storageUrl,
            scenery_pipeline_stage: "pins",
            scenery_fal_request_id: null,
          }
        : {
            scenery_preview_url: storageUrl,
            scenery_fal_request_id: null,
          })

      await supabase
        .from("projects")
        .update({ canvas_state: nextState })
        .eq("id", sceneryProject.id)
    }

    return Response.json({ ok: true })
  } catch (err) {
    console.error("webhook error:", err)
    return Response.json({ error: String(err) }, { status: 500 })
  }
})
