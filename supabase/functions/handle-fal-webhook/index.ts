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

    return Response.json({ ok: true })
  } catch (err) {
    console.error("webhook error:", err)
    return Response.json({ error: String(err) }, { status: 500 })
  }
})
