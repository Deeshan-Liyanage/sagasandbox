import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
)

type FalWebhookPayload = {
  request_id: string
  status: string
  output?: {
    images?: Array<{ url?: string }>
    image?: { url?: string }
  }
}

Deno.serve(async (req) => {
  try {
    const payload = (await req.json()) as FalWebhookPayload
    const { request_id, status, output } = payload

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

    if (status !== "OK") return Response.json({ ok: true })

    const imageUrl = output?.images?.[0]?.url ?? output?.image?.url
    if (!imageUrl) {
      return Response.json({ error: "no image url" }, { status: 400 })
    }

    const imgResponse = await fetch(imageUrl)
    if (!imgResponse.ok) {
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

    return Response.json({ ok: true })
  } catch (err) {
    console.error("webhook error:", err)
    return Response.json({ error: String(err) }, { status: 500 })
  }
})
