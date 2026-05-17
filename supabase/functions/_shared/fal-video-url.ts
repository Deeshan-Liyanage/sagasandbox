/**
 * SYNC WITH `src/lib/fal-video-url.ts` — duplicate for Deno Edge (no Next alias imports).
 */
export function extractVideoUrlFromFalData(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;

  const pickNestedUrl = (v: unknown): string | null => {
    if (!v || typeof v !== "object") return null;
    const url = (v as Record<string, unknown>).url;
    return typeof url === "string" ? url : null;
  };

  const direct =
    pickNestedUrl(o.video) ??
    pickNestedUrl(o.clip) ??
    (typeof o.video_url === "string" ? o.video_url : null);

  if (direct) return direct;

  const videos = o.videos;
  if (Array.isArray(videos)) {
    for (const item of videos) {
      const nested = pickNestedUrl(item);
      if (nested) return nested;
    }
  }

  const nestedOutput = extractVideoUrlFromFalData(o.output);
  if (nestedOutput) return nestedOutput;

  const nestedPayload = extractVideoUrlFromFalData(o.payload);
  if (nestedPayload) return nestedPayload;

  return null;
}
