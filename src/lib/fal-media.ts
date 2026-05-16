import { fal } from "@fal-ai/client";

const FAL_KEY = process.env.FAL_KEY?.trim();
if (FAL_KEY) {
  fal.config({ credentials: FAL_KEY });
}

export async function falWhisperTranscribe(audioUrl: string): Promise<string | null> {
  if (!FAL_KEY) return null;
  try {
    const result = await fal.subscribe("fal-ai/whisper", {
      input: { audio_url: audioUrl },
    });
    const data = result.data as { text?: string };
    return data.text ?? null;
  } catch (err) {
    console.warn("Whisper failed", err);
    return null;
  }
}

export async function falDepthMap(imageUrl: string): Promise<string | null> {
  if (!FAL_KEY) return null;
  try {
    const result = await fal.subscribe("fal-ai/depth-anything", {
      input: { image_url: imageUrl },
    });
    const data = result.data as { depth_map?: { url?: string }; image?: { url?: string } };
    return data.depth_map?.url ?? data.image?.url ?? null;
  } catch (err) {
    console.warn("Depth map failed", err);
    return null;
  }
}

export async function falVideoQueue(options: {
  prompt: string;
  imageUrl?: string;
}): Promise<{ requestId: string } | null> {
  if (!FAL_KEY) return null;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const webhookUrl = siteUrl ? `${siteUrl}/api/webhooks/fal` : undefined;
  const model = "fal-ai/luma-dream-machine";
  const input: Record<string, unknown> = { prompt: options.prompt };
  if (options.imageUrl) input.image_url = options.imageUrl;

  const { request_id } = await fal.queue.submit(model, {
    input,
    ...(webhookUrl ? { webhookUrl } : {}),
  });
  return { requestId: request_id };
}
