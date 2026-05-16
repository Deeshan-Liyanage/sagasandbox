import { fal } from "@fal-ai/client"

import type { StyleConfig } from "@/types/app"

// Trim any accidental leading/trailing whitespace from env values
const FAL_KEY = process.env.FAL_KEY?.trim()
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim()

if (FAL_KEY) {
  fal.config({ credentials: FAL_KEY })
}

/** True when running against localhost — fal.ai webhooks cannot reach localhost. */
function isLocalDev(): boolean {
  if (!SITE_URL) return true
  return SITE_URL.includes("localhost") || SITE_URL.includes("127.0.0.1")
}

export interface FalQueueOptions {
  prompt: string
  model?: string
  imageUrl?: string
  width?: number
  height?: number
}

export interface FalQueueResult {
  requestId: string
  /** Immediately available image URL when synchronous path was used (local dev). */
  imageUrl?: string
}

/**
 * Submits an image-generation job to fal.ai.
 *
 * - **Production** (NEXT_PUBLIC_SITE_URL points to Vercel/public host):
 *   Uses `fal.queue.submit()` with a webhook. The webhook calls
 *   `/api/webhooks/fal` → Supabase edge function → updates DB.
 *
 * - **Local dev** (localhost or no SITE_URL):
 *   Uses `fal.subscribe()` which polls until done and returns the result
 *   immediately. The caller receives `imageUrl` and can update the DB directly.
 */
export async function falQueue(
  options: FalQueueOptions,
): Promise<FalQueueResult | null> {
  if (!FAL_KEY) {
    console.warn("[fal] FAL_KEY not set — skipping image generation")
    return null
  }

  const {
    prompt,
    model = "fal-ai/flux/dev",
    imageUrl,
    width = 1024,
    height = 768,
  } = options

  const input: Record<string, unknown> = {
    prompt,
    image_size: { width, height },
    num_inference_steps: 28,
    guidance_scale: 3.5,
  }

  if (imageUrl) {
    input.image_url = imageUrl
    input.strength = 0.75
  }

  if (isLocalDev()) {
    // Synchronous path: poll fal until image is ready.
    // Works in local dev where fal cannot reach localhost for webhooks.
    console.log("[fal] Local dev — using fal.subscribe() (synchronous)")
    try {
      const result = await fal.subscribe(model, {
        input,
        pollInterval: 3000,
        logs: false,
      })
      const data = result.data as {
        images?: Array<{ url: string }>
        image?: { url: string }
      }
      const resolvedImageUrl = data.images?.[0]?.url ?? data.image?.url
      // fal.subscribe doesn't expose request_id directly; use a synthetic one
      const requestId = result.requestId ?? `local-${Date.now()}`
      return { requestId, imageUrl: resolvedImageUrl }
    } catch (err) {
      console.error("[fal] fal.subscribe() failed:", err)
      throw err
    }
  }

  // Production path: async queue with webhook.
  const webhookUrl = `${SITE_URL}/api/webhooks/fal`
  console.log(`[fal] Submitting to queue with webhook: ${webhookUrl}`)

  try {
    const { request_id } = await fal.queue.submit(model, {
      input,
      webhookUrl,
    })
    console.log(`[fal] Queued request_id=${request_id}`)
    return { requestId: request_id }
  } catch (err) {
    console.error("[fal] fal.queue.submit() failed:", err)
    throw err
  }
}

export function buildPrompt(parts: {
  styleConfig: StyleConfig
  location?: string
  description?: string
  characters?: string[]
}): string {
  const { styleConfig, location, description, characters } = parts
  const chunks: string[] = []

  if (styleConfig.aesthetic_style) chunks.push(styleConfig.aesthetic_style)
  if (styleConfig.aesthetic) chunks.push(styleConfig.aesthetic)
  if (styleConfig.theme) chunks.push(`in a ${styleConfig.theme} setting`)
  if (styleConfig.tone) chunks.push(styleConfig.tone)
  if (location) chunks.push(`at ${location}`)
  if (description) chunks.push(description)
  if (characters?.length) chunks.push(`Characters: ${characters.join(", ")}`)

  return chunks.join(". ")
}

export function projectStyleConfig(project: {
  theme: string
  aesthetic_style: string
  style_config: unknown
}): StyleConfig {
  const cfg =
    typeof project.style_config === "object" && project.style_config !== null
      ? (project.style_config as StyleConfig)
      : {}
  return {
    ...cfg,
    theme: cfg.theme ?? project.theme,
    aesthetic_style: cfg.aesthetic_style ?? project.aesthetic_style,
    aesthetic: cfg.aesthetic ?? project.aesthetic_style,
    tone: cfg.tone ?? project.theme.replace(/_/g, " "),
  }
}
