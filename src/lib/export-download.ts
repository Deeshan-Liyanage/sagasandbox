import type { Export } from "@/types/app";

/** Parse narration export `output_url` JSON array into WAV URLs from storage or fal. */
export function parseAudioExportUrls(
  outputUrl: string | null | undefined,
): string[] {
  if (!outputUrl) return [];
  try {
    const parsed = JSON.parse(outputUrl) as unknown;
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
      return parsed;
    }
  } catch {
    // output_url may not be JSON — ignored
  }
  return [];
}

export function resolveExportPrimaryArtifactUrl(
  type: string,
  outputUrl: string | null | undefined,
  signedUrl?: string | null,
): string | null {
  if (!outputUrl) return null;
  if (type === "audio_script") {
    const urls = parseAudioExportUrls(outputUrl);
    return urls[0] ?? null;
  }
  if (signedUrl && /^https?:\/\//i.test(signedUrl)) return signedUrl;
  return outputUrl;
}

/** Stable download names aligned with Export Terminal labels. */
export function buildExportArtifactFilename(exp: Export): string {
  const short = exp.id.replace(/-/g, "").slice(0, 8);
  switch (exp.type) {
    case "storyboard_pdf":
      return `saga-storyboard-${short}.json`;
    case "animatic_video":
      return `saga-animatic-${short}.mp4`;
    case "audio_script":
      return `saga-narration-${short}.wav`;
    default:
      return `saga-export-${short}`;
  }
}

/**
 * Saves a remote asset when possible (`fetch` + blob + object URL).
 * If CORS/network blocks fetch, falls back to opening the URL.
 */
export async function triggerBrowserDownload(
  remoteUrl: string,
  filename: string,
): Promise<void> {
  try {
    const res = await fetch(remoteUrl, { mode: "cors" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.rel = "noopener";
    anchor.click();
    queueMicrotask(() => URL.revokeObjectURL(objectUrl));
  } catch {
    window.open(remoteUrl, "_blank", "noopener,noreferrer");
  }
}

export async function downloadAudioExportArtifacts(
  exp: Export,
  urls: string[],
): Promise<void> {
  if (urls.length === 0) return;
  if (urls.length === 1) {
    await triggerBrowserDownload(urls[0], buildExportArtifactFilename(exp));
    return;
  }
  const short = exp.id.replace(/-/g, "").slice(0, 8);
  const stem = `saga-narration-${short}`;
  for (let i = 0; i < urls.length; i++) {
    await triggerBrowserDownload(urls[i], `${stem}-${i + 1}.wav`);
    if (i < urls.length - 1) await new Promise((r) => setTimeout(r, 400));
  }
}
