/**
 * Browser-side helpers for the Export Terminal. All file bytes are streamed
 * through the server-side proxy (`/api/projects/{id}/exports/{expId}/download`)
 * so the browser never deals with expired signed URLs, CORS, or Fal CDN
 * authentication. This module only constructs the URL and orchestrates clicks.
 */

import type { Export } from "@/types/app";

export type ExportFileDescriptor = {
  filename: string;
  contentType: string | null;
};

export function downloadProxyUrl(
  projectId: string,
  exportId: string,
  index: number,
): string {
  return `/api/projects/${encodeURIComponent(projectId)}/exports/${encodeURIComponent(
    exportId,
  )}/download?index=${index}`;
}

export function listFilesUrl(projectId: string, exportId: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}/exports/${encodeURIComponent(
    exportId,
  )}/download?list=1`;
}

/** Trigger a single anchor click — browsers reliably handle `download` + same-origin URLs. */
export function downloadViaAnchor(href: string, filename: string): void {
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.target = "_self";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

/** Sequential clicks with a short gap so Chrome/Edge accept multi-file saves. */
export async function downloadAllProxied(
  projectId: string,
  exportId: string,
  files: ExportFileDescriptor[],
  delayMs = 450,
): Promise<void> {
  for (let i = 0; i < files.length; i++) {
    downloadViaAnchor(downloadProxyUrl(projectId, exportId, i), files[i].filename);
    if (i < files.length - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

export type ExportFileLookupResult =
  | { ok: true; files: ExportFileDescriptor[] }
  | { ok: false; error: string };

export async function fetchExportFiles(
  projectId: string,
  exportId: string,
): Promise<ExportFileLookupResult> {
  try {
    const res = await fetch(listFilesUrl(projectId, exportId));
    if (!res.ok) {
      try {
        const body = (await res.json()) as { error?: string };
        return {
          ok: false,
          error: body.error ?? `Download lookup failed (HTTP ${res.status})`,
        };
      } catch {
        return {
          ok: false,
          error: `Download lookup failed (HTTP ${res.status})`,
        };
      }
    }
    const body = (await res.json()) as { files?: ExportFileDescriptor[] };
    return { ok: true, files: body.files ?? [] };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

export function buildAnimaticArtifactFilename(exp: Export): string {
  const short = exp.id.replace(/-/g, "").slice(0, 8);
  return `saga-animatic-${short}.mp4`;
}
