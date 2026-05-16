import { fal } from "@fal-ai/client"

import type { StyleConfig } from "@/types/app"

if (process.env.FAL_KEY) {
  fal.config({ credentials: process.env.FAL_KEY })
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
}

export async function falQueue(
  options: FalQueueOptions,
): Promise<FalQueueResult | null> {
  if (!process.env.FAL_KEY) {
    console.warn("FAL_KEY not set — skipping image generation queue")
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

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  const webhookUrl = siteUrl ? `${siteUrl}/api/webhooks/fal` : undefined

  const { request_id } = await fal.queue.submit(model, {
    input,
    ...(webhookUrl ? { webhookUrl } : {}),
  })

  return { requestId: request_id }
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
