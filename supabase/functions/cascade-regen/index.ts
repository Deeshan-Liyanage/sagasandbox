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

type StyleConfig = {
  aesthetic?: string
  aesthetic_style?: string
  theme?: string
  tone?: string
}

function buildPrompt(
  styleConfig: StyleConfig,
  label: string,
  description?: string | null,
): string {
  const chunks: string[] = []
  if (styleConfig.aesthetic_style) chunks.push(styleConfig.aesthetic_style)
  if (styleConfig.aesthetic) chunks.push(styleConfig.aesthetic)
  if (styleConfig.theme) chunks.push(`in a ${styleConfig.theme} setting`)
  chunks.push(`location: ${label}`)
  if (description) chunks.push(description)
  return chunks.join(". ")
}

async function submitFal(prompt: string): Promise<string> {
  const falKey = Deno.env.get("FAL_KEY")
  const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/handle-fal-webhook`

  const res = await fetch("https://queue.fal.run/fal-ai/flux/dev", {
    method: "POST",
    headers: {
      Authorization: `Key ${falKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: {
        prompt,
        image_size: { width: 1024, height: 768 },
        num_inference_steps: 28,
        guidance_scale: 3.5,
      },
      webhook_url: webhookUrl,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`fal queue failed: ${text}`)
  }

  const json = await res.json()
  return json.request_id as string
}

Deno.serve(async (req) => {
  try {
    const { project_id } = await req.json()

    const { data: project } = await supabase
      .from("projects")
      .select("style_config")
      .eq("id", project_id)
      .single()

    if (!project) {
      return Response.json({ error: "project not found" }, { status: 404 })
    }

    const styleConfig = (project.style_config ?? {}) as StyleConfig

    const { data: pins } = await supabase
      .from("location_pins")
      .select("id, label, description")
      .eq("project_id", project_id)

    const { data: events } = await supabase
      .from("timeline_events")
      .select("id, title, description")
      .eq("project_id", project_id)

    let queued = 0

    for (const pin of pins ?? []) {
      await supabase
        .from("location_pins")
        .update({ gen_status: "pending" })
        .eq("id", pin.id)

      const requestId = await submitFal(
        buildPrompt(styleConfig, pin.label, pin.description),
      )

      await supabase
        .from("location_pins")
        .update({ fal_request_id: requestId, gen_status: "generating" })
        .eq("id", pin.id)

      queued++
    }

    for (const event of events ?? []) {
      await supabase
        .from("timeline_events")
        .update({ gen_status: "pending" })
        .eq("id", event.id)

      const prompt = [
        styleConfig.aesthetic_style,
        styleConfig.theme ? `in a ${styleConfig.theme} setting` : null,
        `scene: ${event.description ?? event.title}`,
      ]
        .filter(Boolean)
        .join(". ")

      const requestId = await submitFal(prompt)

      await supabase
        .from("timeline_events")
        .update({ fal_request_id: requestId, gen_status: "generating" })
        .eq("id", event.id)

      queued++
    }

    return Response.json({ queued })
  } catch (err) {
    console.error("cascade-regen error:", err)
    return Response.json({ error: String(err) }, { status: 500 })
  }
})
