/**
 * POST /api/fal/poll
 *
 * Polls fal.ai for the result of a queued request and writes the image URL
 * directly to the matching DB row. Useful for:
 *   - Production edge cases where the webhook was missed
 *   - Manual retry when a pin/event is stuck in "generating"
 *
 * Body: { request_id: string }
 * Returns: { ok: true, imageUrl?: string, status: string }
 */
import { NextResponse } from "next/server"
import { fal } from "@fal-ai/client"
import { createAdminClient } from "@/lib/supabase-admin"
import type { Json } from "@/types/db"

const FAL_KEY = process.env.FAL_KEY?.trim()
if (FAL_KEY) {
  fal.config({ credentials: FAL_KEY })
}

export async function POST(request: Request) {
  if (!FAL_KEY) {
    return NextResponse.json({ error: "FAL_KEY not configured" }, { status: 503 })
  }

  const body = (await request.json()) as { request_id?: string }
  if (!body.request_id) {
    return NextResponse.json({ error: "request_id is required" }, { status: 400 })
  }

  const requestId = body.request_id

  try {
    const status = await fal.queue.status("fal-ai/flux/dev", {
      requestId,
      logs: false,
    })

    if (status.status !== "COMPLETED") {
      return NextResponse.json({ ok: true, status: status.status })
    }

    // Fetch the result
    const result = await fal.queue.result("fal-ai/flux/dev", { requestId })
    const data = result.data as {
      images?: Array<{ url: string }>
      image?: { url: string }
    }
    const imageUrl = data.images?.[0]?.url ?? data.image?.url
    if (!imageUrl) {
      return NextResponse.json({ error: "No image in fal result" }, { status: 502 })
    }

    // Update whichever row holds this request_id
    const supabase = createAdminClient()

    const { data: pin } = await supabase
      .from("location_pins")
      .select("id, gen_status")
      .eq("fal_request_id", requestId)
      .maybeSingle()

    const { data: event } = await supabase
      .from("timeline_events")
      .select("id, gen_status")
      .eq("fal_request_id", requestId)
      .maybeSingle()

    const { data: character } = await supabase
      .from("characters")
      .select("id, gen_status")
      .eq("fal_request_id", requestId)
      .maybeSingle()

    if (pin && pin.gen_status !== "done") {
      await supabase
        .from("location_pins")
        .update({ generated_image_url: imageUrl, gen_status: "done" })
        .eq("id", pin.id)
    }

    if (event && event.gen_status !== "done") {
      await supabase
        .from("timeline_events")
        .update({ generated_image_url: imageUrl, gen_status: "done" })
        .eq("id", event.id)
    }

    if (character && character.gen_status !== "done") {
      await supabase
        .from("characters")
        .update({ generated_portrait_url: imageUrl, gen_status: "done" })
        .eq("id", character.id)
    }

    const { data: sceneryProject } = await supabase
      .from("projects")
      .select("id, canvas_state")
      .filter("canvas_state->_saga->>scenery_request_id", "eq", requestId)
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
        .update({ canvas_state: { ...state, _saga: saga } as Json })
        .eq("id", sceneryProject.id)
    }

    return NextResponse.json({ ok: true, status: "COMPLETED", imageUrl })
  } catch (err) {
    console.error("[fal/poll] Error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    )
  }
}
