import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db";

export type ResolvedExportArtifact = {
  filename: string;
  url: string;
};

const SIGN_BUCKETS = ["exports", "audio"] as const;

function stripQuery(u: string): string {
  const i = u.indexOf("?");
  return i === -1 ? u : u.slice(0, i);
}

async function signedUrlForObject(
  supabase: SupabaseClient<Database>,
  bucket: string,
  objectPath: string,
): Promise<string | undefined> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(objectPath.trim(), 60 * 60);
  if (error || !data?.signedUrl) return undefined;
  return data.signedUrl;
}

async function signedPathDefaultExports(
  supabase: SupabaseClient<Database>,
  objectPath: string,
): Promise<string | undefined> {
  const p = objectPath.trim().replace(/^\/+/, "");
  if (!p) return undefined;
  return signedUrlForObject(supabase, "exports", p);
}

/**
 * Parses Supabase Storage public/sign URLs for known buckets (`exports`, `audio`)
 * and returns a freshly signed HTTPS URL via the authenticated client.
 */
export async function refreshSupabaseStoredUrl(
  supabase: SupabaseClient<Database>,
  absoluteUrl: string,
): Promise<string | undefined> {
  const trimmed = absoluteUrl.trim();
  if (!trimmed) return undefined;

  if (!/^https?:\/\//i.test(trimmed)) {
    const p = trimmed.replace(/^\/+/, "");
    const firstSlash = p.indexOf("/");
    if (firstSlash > 0) {
      const maybeBucket = p.slice(0, firstSlash);
      if ((SIGN_BUCKETS as readonly string[]).includes(maybeBucket)) {
        const objectPath = p.slice(firstSlash + 1).trim();
        if (objectPath) {
          return signedUrlForObject(supabase, maybeBucket, objectPath);
        }
      }
    }
    return signedPathDefaultExports(supabase, trimmed);
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
    if (!bucket || !(SIGN_BUCKETS as readonly string[]).includes(bucket)) {
      return trimmed;
    }

    try {
      const objectPath = decodeURIComponent(encodedObject.replace(/\+/g, " "));
      const refreshed = await signedUrlForObject(supabase, bucket, objectPath);
      return refreshed ?? trimmed;
    } catch {
      return trimmed;
    }
  } catch {
    return trimmed;
  }
}

/** Parse narration export `output_url` JSON array of absolute URLs from storage/fal. */
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
    if (
      base &&
      /\.(wav|mp3|mpeg|opus|ogg|flac|mp4|json|pdf|webm|mov)$/i.test(base)
    ) {
      return base;
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

function inferFilenameOneOff(
  type: Database["public"]["Tables"]["exports"]["Row"]["type"],
  urlStr: string,
  idSlice: string,
): string {
  const lower = urlStr.toLowerCase();
  switch (type) {
    case "storyboard_pdf":
      return lower.includes(".pdf")
        ? `saga-storyboard-${idSlice}.pdf`
        : `saga-storyboard-${idSlice}.json`;
    case "animatic_video":
      return lower.endsWith(".json") || lower.includes(".json")
        ? `saga-animatic-${idSlice}-manifest.json`
        : `saga-animatic-${idSlice}.mp4`;
    case "audio_script":
      return `saga-narration-${idSlice}.wav`;
    default:
      return `saga-export-${idSlice}`;
  }
}

async function fallbackArtifactsFromOutputUrl(
  supabase: SupabaseClient<Database>,
  row: Pick<
    Database["public"]["Tables"]["exports"]["Row"],
    "id" | "type" | "output_url"
  >,
): Promise<ResolvedExportArtifact[]> {
  const out = row.output_url?.trim() ?? "";
  if (!out) return [];

  const idSlice = row.id.slice(0, 8).replace(/-/g, "");

  if (/^https?:\/\//i.test(out)) {
    const refreshed = await refreshSupabaseStoredUrl(supabase, out);
    const urlFinal = refreshed ?? out;
    if (!/^https?:\/\//i.test(urlFinal)) return [];
    return [
      {
        filename: guessFilenameFromUrl(out, inferFilenameOneOff(row.type, urlFinal, idSlice)),
        url: urlFinal,
      },
    ];
  }

  const signed = await signedPathDefaultExports(supabase, out);
  if (signed) {
    return [
      {
        filename: inferFilenameOneOff(row.type, signed, idSlice),
        url: signed,
      },
    ];
  }

  return [];
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
  const idSliceNorm = id.replace(/-/g, "").slice(0, 8);
  const files: ResolvedExportArtifact[] = [];

  if (row.type === "storyboard_pdf") {
    const objectPath = `exports/${id}/storyboard.json`;
    let signed = await signedUrlForObject(supabase, "exports", objectPath);

    const outClean = row.output_url?.trim() ?? "";
    if (!signed && outClean) {
      if (/^https?:\/\//i.test(outClean)) {
        signed = await refreshSupabaseStoredUrl(supabase, outClean);
      } else {
        signed = await signedUrlForObject(
          supabase,
          "exports",
          outClean.replace(/^\/+/, ""),
        );
      }
    }

    if (signed) {
      files.push({
        filename: `saga-storyboard-${id.slice(0, 8)}.json`,
        url: signed,
      });
    }
  } else if (row.type === "animatic_video") {
    const mp4Canonical = `exports/${id}/animatic.mp4`;
    const mp4Signed = await signedUrlForObject(supabase, "exports", mp4Canonical);
    if (mp4Signed) {
      files.push({ filename: `saga-animatic-${id.slice(0, 8)}.mp4`, url: mp4Signed });
    }

    const jsonCanonical = `exports/${id}/animatic.json`;
    const jsonSigned = await signedUrlForObject(supabase, "exports", jsonCanonical);
    if (jsonSigned) {
      files.push({
        filename: `saga-animatic-${id.slice(0, 8)}-manifest.json`,
        url: jsonSigned,
      });
    }

    const out = row.output_url?.trim() ?? "";
    if (files.length === 0 && out) {
      const resolved =
        /^https?:\/\//i.test(out)
          ? ((await refreshSupabaseStoredUrl(supabase, out)) ?? out)
          : await signedPathDefaultExports(supabase, out);
      if (resolved) {
        files.push({
          filename: inferFilenameOneOff(row.type, resolved, idSliceNorm),
          url: resolved,
        });
      }
    }
  } else if (row.type === "audio_script") {
    const outClean = row.output_url?.trim() ?? "";
    const urlsStrict = parseNarrationOutputUrls(row.output_url);
    const urls = urlsStrict.length > 0 ? urlsStrict : narrationUrlsLoose(row.output_url);
    const short = idSliceNorm;

    for (let idx = 0; idx < urls.length; idx++) {
      const url = urls[idx];
      const refreshed = (await refreshSupabaseStoredUrl(supabase, url)) ?? url;
      const fname =
        urls.length <= 1
          ? `saga-narration-${short}.wav`
          : `saga-narration-${short}-${idx + 1}.wav`;
      files.push({
        filename: guessFilenameFromUrl(url, fname),
        url: refreshed,
      });
    }

    if (files.length === 0 && /^https?:\/\//i.test(outClean)) {
      const refreshed = await refreshSupabaseStoredUrl(supabase, outClean);
      const url = refreshed ?? outClean;
      files.push({
        filename: `saga-narration-${short}.wav`,
        url,
      });
    }

    if (files.length === 0 && outClean) {
      try {
        const trimmed = JSON.parse(outClean) as unknown;
        if (
          typeof trimmed === "string" &&
          /^https?:\/\//i.test(trimmed.trim())
        ) {
          const u = trimmed.trim();
          const r = (await refreshSupabaseStoredUrl(supabase, u)) ?? u;
          files.push({ filename: guessFilenameFromUrl(u, `saga-narration-${short}.wav`), url: r });
        }
      } catch {
        /* ignore */
      }
    }
  }

  if (files.length === 0) {
    return fallbackArtifactsFromOutputUrl(supabase, row);
  }

  const seen = new Set<string>();
  return files.filter((f) => {
    const k = `${f.filename}|${f.url}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
