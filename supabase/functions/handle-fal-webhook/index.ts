import { getAdminClient } from "../_shared/admin-client.ts"

type FalImageOutput = {
  images?: Array<{ url?: string }>
  image?: { url?: string }
}

/** Shape of the POST body fal.ai sends to the webhook URL. */
type FalWebhookBody = {
  request_id: string
  /** "OK" on success, "ERROR" on failure. */
  status: "OK" | "ERROR" | string
  /** Present when status === "OK" — the model's raw output object. */
  payload?: FalImageOutput
  /** Present when status === "ERROR". */
  error?: string
}

Deno.serve(async (req) => {
  let supabase
  try {
    supabase = getAdminClient()
  } catch (err) {
    console.error("[fal-webhook] init failed:", err)
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }

  try {
    const body = (await req.json()) as FalWebhookBody
    const { request_id, status, payload: falOutput } = body

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
      console.error(`[fal-webhook] request_id=${request_id} ERROR`)
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

      const { data: sceneryProject } = await supabase
        .from("projects")
        .select("id, canvas_state")
        .filter("canvas_state->_saga->>scenery_request_id", "eq", request_id)
        .maybeSingle()

      if (sceneryProject?.canvas_state && typeof sceneryProject.canvas_state === "object") {
        const state = sceneryProject.canvas_state as Record<string, unknown>
        const saga =
          state._saga && typeof state._saga === "object" && !Array.isArray(state._saga)
            ? { ...(state._saga as Record<string, unknown>) }
            : {}
        saga.scenery_preview_url = null
        await supabase
          .from("projects")
          .update({ canvas_state: { ...state, _saga: saga } })
          .eq("id", sceneryProject.id)
      }

      return Response.json({ ok: true })
    }

    if (status !== "OK") {
      console.warn(`[fal-webhook] request_id=${request_id} unexpected status=${status}`)
      return Response.json({ ok: true })
    }

    const imageUrl = falOutput?.images?.[0]?.url ?? falOutput?.image?.url
    if (!imageUrl) {
      console.error(`[fal-webhook] request_id=${request_id} no image url in payload`, JSON.stringify(falOutput))
      return Response.json({ error: "no image url" }, { status: 400 })
    }

    console.log(`[fal-webhook] request_id=${request_id} imageUrl=${imageUrl}`)

    // Store the fal.ai CDN URL directly — simpler and avoids an extra fetch+upload round-trip.
    // The images bucket is public so previously uploaded files remain accessible too.
    if (pin && pin.gen_status !== "done") {
      await supabase
        .from("location_pins")
        .update({
          generated_image_url: imageUrl,
          gen_status: "done",
        })
        .eq("id", pin.id)
    }

    if (event && event.gen_status !== "done") {
      await supabase
        .from("timeline_events")
        .update({
          generated_image_url: imageUrl,
          gen_status: "done",
        })
        .eq("id", event.id)
    }

    if (character && character.gen_status !== "done") {
      await supabase
        .from("characters")
        .update({
          generated_portrait_url: imageUrl,
          gen_status: "done",
        })
        .eq("id", character.id)
    }

    // Canvas scenery synthesis (stored in projects.canvas_state._saga)
    const { data: sceneryProject } = await supabase
      .from("projects")
      .select("id, canvas_state")
      .filter("canvas_state->_saga->>scenery_request_id", "eq", request_id)
      .maybeSingle()

    if (sceneryProject?.canvas_state && typeof sceneryProject.canvas_state === "object") {
      const state = sceneryProject.canvas_state as Record<string, unknown>
      const saga =
        state._saga && typeof state._saga === "object" && !Array.isArray(state._saga)
          ? { ...(state._saga as Record<string, unknown>) }
          : {}
      saga.scenery_preview_url = imageUrl
      await supabase
        .from("projects")
        .update({ canvas_state: { ...state, _saga: saga } })
        .eq("id", sceneryProject.id)
    }

    return Response.json({ ok: true })
  } catch (err) {
    console.error("webhook error:", err)
    return Response.json({ error: String(err) }, { status: 500 })
  }
})
