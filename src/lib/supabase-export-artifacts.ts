import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db";

export type ResolvedExportArtifact = {
  filename: string;
  url: string;
};

const EXPORT_BUCKET = "exports";

function stripQuery(u: string): string {
  const i = u.indexOf("?");
  return i === -1 ? u : u.slice(0, i);
}

async function signedOrUndefined(
  supabase: SupabaseClient<Database>,
  objectPath: string,
): Promise<string | undefined> {
  const { data, error } = await supabase.storage
    .from(EXPORT_BUCKET)
    .createSignedUrl(objectPath, 60 * 60);
  if (error || !data?.signedUrl) return undefined;
  return data.signedUrl;
}

/** Parse narration output_url JSON array of absolute URLs from storage/fal. */
export function parseNarrationOutputUrls(raw: string | null | undefined): string[] {
  if (!raw || !String(raw).trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
      return parsed.filter((u) => /^https?:\/\//i.test(u));
    }
  } catch {
    return [];
  }
  return [];
}

function guessFilenameFromUrl(u: string, fallback: string): string {
  try {
    const path = stripQuery(new URL(u).pathname);
    const base = path.split("/").pop();
    if (base && /\.(wav|mp3|mpeg|opus|ogg|flac)$/i.test(base)) return base;
  } catch {
    /* ignore */
  }
  return fallback;
}

async function deriveSignedFromOutputUrl(
  supabase: SupabaseClient<Database>,
  absoluteUrl: string,
): Promise<string | undefined> {
  const trimmed = absoluteUrl.trim();
  if (!trimmed) return undefined;

  if (!/^https?:\/\//i.test(trimmed)) {
    return signedOrUndefined(supabase, trimmed.replace(/^\/+/, ""));
  }

  try {
    const u = new URL(trimmed);

    const pub = "/storage/v1/object/public/";
    const sign = "/storage/v1/object/sign/";
    let rest: string | null = null;
    let idx = u.pathname.indexOf(pub);
    if (idx !== -1) rest = u.pathname.slice(idx + pub.length);
    else {
      idx = u.pathname.indexOf(sign);
      if (idx !== -1) rest = u.pathname.slice(idx + sign.length);
    }
    if (!rest) {
      return trimmed;
    }
    const slash = rest.indexOf("/");
    if (slash < 1) return trimmed;
    const bucket = decodeURIComponent(rest.slice(0, slash));
    const encodedObject = rest.slice(slash + 1);
    if (!bucket || bucket !== EXPORT_BUCKET) {
      return trimmed;
    }

    try {
      const objectPath = decodeURIComponent(encodedObject.replace(/\+/g, " "));
      const refreshed = await signedOrUndefined(supabase, objectPath);
      return refreshed ?? trimmed;
    } catch {
      return trimmed;
    }
  } catch {
    return trimmed;
  }
}

/** Build ordered HTTPS download URLs for a completed exports row (server-only). */
export async function resolveExportArtifacts(
  supabase: SupabaseClient<Database>,
  row: Pick<
    Database["public"]["Tables"]["exports"]["Row"],
    "id" | "type" | "status" | "output_url"
  >,
): Promise<ResolvedExportArtifact[]> {
  if (row.status !== "done") return [];

  const id = row.id;
  const files: ResolvedExportArtifact[] = [];

  if (row.type === "storyboard_pdf") {
    const path = `exports/${id}/storyboard.json`;
    const signed = await signedOrUndefined(supabase, path);
    const outClean = row.output_url?.trim() ?? "";
    if (signed) {
      files.push({ filename: `saga-storyboard-${id.slice(0, 8)}.json`, url: signed });
    } else if (outClean && /^https?:\/\//i.test(outClean)) {
      const derived = await deriveSignedFromOutputUrl(supabase, outClean);
      if (derived) {
        files.push({
          filename: `saga-storyboard-${id.slice(0, 8)}.json`,
          url: derived,
        });
      }
    }
  } else if (row.type === "animatic_video") {
    const mp4Signed = await signedOrUndefined(supabase, `exports/${id}/animatic.mp4`);
    if (mp4Signed) {
      files.push({ filename: `saga-animatic-${id.slice(0, 8)}.mp4`, url: mp4Signed });
    }
    const jsonSigned = await signedOrUndefined(supabase, `exports/${id}/animatic.json`);
    if (jsonSigned) {
      files.push({
        filename: `saga-animatic-${id.slice(0, 8)}-manifest.json`,
        url: jsonSigned,
      });
    }

    const out = row.output_url?.trim() ?? "";
    if (files.length === 0 && out) {
      const resolved = await deriveSignedFromOutputUrl(supabase, out);
      if (resolved) {
        files.push({
          filename: resolved.toLowerCase().includes(".json")
            ? `saga-animatic-${id.slice(0, 8)}.json`
            : `saga-animatic-${id.slice(0, 8)}.mp4`,
          url: resolved,
        });
      }
    }
  } else if (row.type === "audio_script") {
    const outClean = row.output_url?.trim() ?? "";
    const urls = parseNarrationOutputUrls(row.output_url);
    const short = id.replace(/-/g, "").slice(0, 8);
    for (let idx = 0; idx < urls.length; idx++) {
      const url = urls[idx];
      const refreshed = (await deriveSignedFromOutputUrl(supabase, url)) ?? url;
      const fname =
        urls.length <= 1
          ? `saga-narration-${short}.wav`
          : `saga-narration-${short}-${idx + 1}.wav`;
      files.push({ filename: guessFilenameFromUrl(url, fname), url: refreshed });
    }

    if (files.length === 0 && /^https?:\/\//i.test(outClean)) {
      files.push({
        filename: `saga-narration-${short}.wav`,
        url: outClean,
      });
    }
  }

  return files;
}
