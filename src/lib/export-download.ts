/**
 * Browser-side export downloads. Server resolves filenames + HTTPS URLs via
 * `GET .../exports/:id` (`artifacts`). This module only persists blobs locally.
 */

import type { Export } from "@/types/app";

export type NamedDownloadLink = {
  filename: string;
  url: string;
};

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

/** Saves each artifact with a short delay so browsers accept multiple sequential saves. */
export async function downloadNamedArtifactsSequential(
  items: NamedDownloadLink[],
  delayMs = 380,
): Promise<void> {
  if (items.length === 0) return;
  for (let i = 0; i < items.length; i++) {
    await triggerBrowserDownload(items[i].url, items[i].filename);
    if (i < items.length - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
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
