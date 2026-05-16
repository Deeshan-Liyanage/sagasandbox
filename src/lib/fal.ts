import { fal } from "@fal-ai/client"

import type { StyleConfig } from "@/types/app"

// Trim any accidental leading/trailing whitespace from env values
const FAL_KEY = process.env.FAL_KEY?.trim()

if (FAL_KEY) {
  fal.config({ credentials: FAL_KEY })
}

/**
 * Public URL the fal.ai webhook should POST back to.
 *
 * Resolution order:
 *   1. `NEXT_PUBLIC_SITE_URL` — explicit override, what we tell users
 *      to set in production. Honored as-is so they can point at a
 *      custom domain or a proxy.
 *   2. `VERCEL_URL` — auto-set on Vercel deployments (per-deployment
 *      hostname like `sagasandbox-abc123.vercel.app`, no scheme). This
 *      fallback means a fresh deploy without env wiring still uses the
 *      async webhook path instead of accidentally hitting the
 *      `fal.subscribe()` synchronous path and tripping the 10s/25s
 *      serverless timeout for a 20s+ flux generation.
 *   3. `undefined` — interpreted as local dev (loopback).
 */
function resolvePublicSiteUrl(): string | undefined {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (explicit) return explicit
  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) return vercel.startsWith("http") ? vercel : `https://${vercel}`
  return undefined
}

/** True when running against localhost — fal.ai webhooks cannot reach localhost. */
function isLocalDev(): boolean {
  const siteUrl = resolvePublicSiteUrl()
  if (!siteUrl) return true
  return siteUrl.includes("localhost") || siteUrl.includes("127.0.0.1")
}

export const FLUX_TEXT_MODEL = "fal-ai/flux/dev"
export const FLUX_IMG2IMG_MODEL = "fal-ai/flux/dev/image-to-image"

export interface FalQueueOptions {
  prompt: string
  model?: string
  imageUrl?: string
  width?: number
  height?: number
  /** Img2img adherence to reference (0.01–1). Default 0.88 for map sketches. */
  strength?: number
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
    console.error(
      "[fal] FAL_KEY env var is not set. Image generation is disabled. " +
        "Set FAL_KEY in your Next.js environment (.env.local or Vercel Project " +
        "Settings → Environment Variables) AND as a Supabase Edge Function secret " +
        "(supabase secrets set FAL_KEY=...) — the Next.js route and the " +
        "handle-fal-webhook function each read it independently.",
    )
    return null
  }

  const { prompt, imageUrl, width = 1024, height = 768 } = options
  const model =
    options.model ?? (imageUrl ? FLUX_IMG2IMG_MODEL : FLUX_TEXT_MODEL)

  const input: Record<string, unknown> = {
    prompt,
    image_size: { width, height },
    num_inference_steps: imageUrl ? 40 : 28,
    guidance_scale: 3.5,
  }

  if (imageUrl) {
    input.image_url = imageUrl
    input.strength = options.strength ?? 0.88
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
  const siteUrl = resolvePublicSiteUrl()
  const webhookUrl = `${siteUrl}/api/webhooks/fal`
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
