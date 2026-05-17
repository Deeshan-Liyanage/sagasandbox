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

function extractPathExtension(remoteUrl: string): string | null {
  try {
    const pathname = new URL(remoteUrl).pathname;
    const base = pathname.split("/").pop() ?? pathname;
    const beforeQuery = base.split("?")[0] ?? base;
    const dot = beforeQuery.lastIndexOf(".");
    if (dot <= 0) return null;
    return beforeQuery.slice(dot + 1) || null;
  } catch {
    const match = /\.([a-zA-Z0-9]+)(?:\?|$)/.exec(remoteUrl);
    return match?.[1] ?? null;
  }
}

/** Animatic jobs may finalize as Luma manifest JSON or an MP4 in storage — infer from URL + MIME. */
export function inferAnimaticDownloadExtension(
  remoteUrl: string,
  contentTypeHeader: string | null | undefined,
  blobType: string,
): string {
  const fromUrl = extractPathExtension(remoteUrl);
  if (fromUrl) {
    const e = fromUrl.toLowerCase();
    if (e === "mp4") return "mp4";
    if (e === "json") return "json";
    if (e === "webm") return "webm";
    if (e === "mov") return "mov";
  }

  const combined = `${contentTypeHeader ?? ""} ${blobType}`.toLowerCase();
  if (combined.includes("json")) return "json";
  if (combined.includes("mp4")) return "mp4";
  if (combined.includes("webm")) return "webm";
  if (combined.includes("quicktime") || combined.includes("video/quicktime"))
    return "mov";

  return "mp4";
}

export function buildAnimaticArtifactFilename(
  exp: Export,
  remoteUrl: string,
  contentTypeHeader: string | null | undefined,
  blobType: string,
): string {
  const short = exp.id.replace(/-/g, "").slice(0, 8);
  const ext = inferAnimaticDownloadExtension(
    remoteUrl,
    contentTypeHeader,
    blobType,
  );
  return `saga-animatic-${short}.${ext}`;
}

/** Stable download names aligned with Export Terminal labels (non-animatic). */
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

function saveBlobAsDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.click();
  queueMicrotask(() => URL.revokeObjectURL(objectUrl));
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
    saveBlobAsDownload(blob, filename);
  } catch {
    window.open(remoteUrl, "_blank", "noopener,noreferrer");
  }
}

/** Single-file timeline export download with correct animatic extension from response metadata. */
export async function triggerExportArtifactDownload(
  exp: Export,
  remoteUrl: string,
): Promise<void> {
  try {
    const res = await fetch(remoteUrl, { mode: "cors" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();

    const filename =
      exp.type === "animatic_video"
        ? buildAnimaticArtifactFilename(
            exp,
            remoteUrl,
            res.headers.get("content-type"),
            blob.type,
          )
        : buildExportArtifactFilename(exp);

    saveBlobAsDownload(blob, filename);
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
