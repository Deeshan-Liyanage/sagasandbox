import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db";

/**
 * Server-only helpers for resolving an `exports` row into concrete downloadable
 * files. Two output shapes are exposed:
 *
 *  - `ResolvedExportArtifact` — name + HTTPS URL (used for the JSON API
 *    response so the client can show what would be downloaded).
 *  - `ResolvedExportSource` — name + a `fetch` description with optional
 *    storage-bucket path so the download proxy can stream the bytes through
 *    the server without depending on browser CORS or short-lived signed URLs.
 */

export type ResolvedExportArtifact = {
  filename: string;
  url: string;
};

export type ResolvedExportSource =
  | {
      filename: string;
      kind: "storage";
      bucket: string;
      objectPath: string;
      contentType?: string;
    }
  | {
      filename: string;
      kind: "remote";
      url: string;
      contentType?: string;
    };

const SIGN_BUCKETS = ["exports", "audio"] as const;

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  json: "application/json",
  pdf: "application/pdf",
  wav: "audio/wav",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  opus: "audio/ogg",
};

function extOf(name: string): string | null {
  const m = /\.([a-z0-9]+)(?:\?|$)/i.exec(name);
  return m?.[1]?.toLowerCase() ?? null;
}

function contentTypeFromFilename(name: string): string | undefined {
  const ext = extOf(name);
  if (!ext) return undefined;
  return CONTENT_TYPE_BY_EXT[ext];
}

function stripQuery(u: string): string {
  const i = u.indexOf("?");
  return i === -1 ? u : u.slice(0, i);
}

async function signedUrlForObject(
  supabase: SupabaseClient<Database>,
  bucket: string,
  objectPath: string,
): Promise<string | undefined> {
  const trimmed = objectPath.trim().replace(/^\/+/, "");
  if (!trimmed) return undefined;
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(trimmed, 60 * 60);
  if (error || !data?.signedUrl) return undefined;
  return data.signedUrl;
}

async function objectExists(
  supabase: SupabaseClient<Database>,
  bucket: string,
  objectPath: string,
): Promise<boolean> {
  const trimmed = objectPath.trim().replace(/^\/+/, "");
  if (!trimmed) return false;
  const lastSlash = trimmed.lastIndexOf("/");
  const dir = lastSlash >= 0 ? trimmed.slice(0, lastSlash) : "";
  const base = lastSlash >= 0 ? trimmed.slice(lastSlash + 1) : trimmed;
  const { data, error } = await supabase.storage
    .from(bucket)
    .list(dir || undefined, { search: base, limit: 1 });
  if (error || !data) return false;
  return data.some((f) => f.name === base);
}

type SupabasePathInfo = { bucket: string; objectPath: string };

/** Parses a Supabase Storage public/sign URL into (bucket, objectPath) — returns null otherwise. */
function parseSupabaseStorageUrl(absoluteUrl: string): SupabasePathInfo | null {
  try {
    const u = new URL(absoluteUrl);
    const pub = "/storage/v1/object/public/";
    const sign = "/storage/v1/object/sign/";
    let rest: string | null = null;
    let idx = u.pathname.indexOf(pub);
    if (idx !== -1) rest = u.pathname.slice(idx + pub.length);
    else {
      idx = u.pathname.indexOf(sign);
      if (idx !== -1) rest = u.pathname.slice(idx + sign.length);
    }
    if (!rest) return null;
    const firstSlash = rest.indexOf("/");
    if (firstSlash < 1) return null;
    const bucket = decodeURIComponent(rest.slice(0, firstSlash));
    if (!bucket) return null;
    const encoded = rest.slice(firstSlash + 1);
    const objectPath = decodeURIComponent(encoded.replace(/\+/g, " "));
    if (!objectPath) return null;
    return { bucket, objectPath };
  } catch {
    return null;
  }
}

/**
 * Returns a freshly signed HTTPS URL when `absoluteUrl` points at a known
 * Supabase Storage bucket, otherwise returns the original URL unchanged.
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
    return signedUrlForObject(supabase, "exports", p);
  }

  const info = parseSupabaseStorageUrl(trimmed);
  if (!info) return trimmed;
  if (!(SIGN_BUCKETS as readonly string[]).includes(info.bucket)) return trimmed;
  const refreshed = await signedUrlForObject(
    supabase,
    info.bucket,
    info.objectPath,
  );
  return refreshed ?? trimmed;
}

/** Parses narration `output_url`: JSON array of HTTPS URLs (preferred) or single URL. */
export function parseNarrationOutputUrls(
  raw: string | null | undefined,
): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) {
      return parsed
        .filter((x): x is string => typeof x === "string")
        .map((s) => s.trim())
        .filter((s) => /^https?:\/\//i.test(s));
    }
    if (typeof parsed === "string" && /^https?:\/\//i.test(parsed.trim())) {
      return [parsed.trim()];
    }
  } catch {
    /* fall through */
  }

  if (/^https?:\/\//i.test(trimmed)) return [trimmed];
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

/**
 * Single source of truth for "what files does this completed export contain".
 * Returns `ResolvedExportSource[]`: storage paths get the bucket + key so the
 * proxy streams directly; remote URLs (Fal CDN, etc.) are passed through for
 * server-side fetch.
 */
export async function resolveExportSources(
  supabase: SupabaseClient<Database>,
  row: Pick<
    Database["public"]["Tables"]["exports"]["Row"],
    "id" | "type" | "status" | "output_url"
  >,
): Promise<ResolvedExportSource[]> {
  if (row.status !== "done") return [];

  const id = row.id;
  const dashId = id.slice(0, 8);
  const compactId = id.replace(/-/g, "").slice(0, 8);
  const sources: ResolvedExportSource[] = [];
  const outClean = row.output_url?.trim() ?? "";

  if (row.type === "storyboard_pdf") {
    const candidates: { bucket: string; objectPath: string }[] = [
      { bucket: "exports", objectPath: `exports/${id}/storyboard.json` },
      { bucket: "exports", objectPath: `exports/${id}/storyboard.pdf` },
    ];

    if (outClean && !/^https?:\/\//i.test(outClean)) {
      candidates.unshift({
        bucket: "exports",
        objectPath: outClean.replace(/^\/+/, ""),
      });
    }
    if (outClean && /^https?:\/\//i.test(outClean)) {
      const info = parseSupabaseStorageUrl(outClean);
      if (info && (SIGN_BUCKETS as readonly string[]).includes(info.bucket)) {
        candidates.unshift({ bucket: info.bucket, objectPath: info.objectPath });
      }
    }

    for (const { bucket, objectPath } of candidates) {
      if (await objectExists(supabase, bucket, objectPath)) {
        const filename =
          extOf(objectPath) === "pdf"
            ? `saga-storyboard-${dashId}.pdf`
            : `saga-storyboard-${dashId}.json`;
        sources.push({
          filename,
          kind: "storage",
          bucket,
          objectPath,
          contentType: contentTypeFromFilename(filename),
        });
        break;
      }
    }
  } else if (row.type === "animatic_video") {
    const mp4Path = `exports/${id}/animatic.mp4`;
    if (await objectExists(supabase, "exports", mp4Path)) {
      const filename = `saga-animatic-${dashId}.mp4`;
      sources.push({
        filename,
        kind: "storage",
        bucket: "exports",
        objectPath: mp4Path,
        contentType: "video/mp4",
      });
    }

    const jsonPath = `exports/${id}/animatic.json`;
    if (await objectExists(supabase, "exports", jsonPath)) {
      const filename = `saga-animatic-${dashId}-manifest.json`;
      sources.push({
        filename,
        kind: "storage",
        bucket: "exports",
        objectPath: jsonPath,
        contentType: "application/json",
      });
    }

    // Output_url is set after the webhook persists the MP4 — but if the row
    // came through the inline / fallback path it may point at a Fal CDN URL
    // we haven't mirrored to storage yet. Surface that URL so the proxy can
    // stream it directly.
    if (sources.length === 0 && outClean) {
      if (/^https?:\/\//i.test(outClean)) {
        const info = parseSupabaseStorageUrl(outClean);
        if (info && (SIGN_BUCKETS as readonly string[]).includes(info.bucket)) {
          const ext = extOf(info.objectPath) ?? "mp4";
          const filename =
            ext === "json"
              ? `saga-animatic-${dashId}-manifest.json`
              : `saga-animatic-${dashId}.${ext}`;
          sources.push({
            filename,
            kind: "storage",
            bucket: info.bucket,
            objectPath: info.objectPath,
            contentType: contentTypeFromFilename(filename),
          });
        } else {
          const ext = extOf(stripQuery(outClean)) ?? "mp4";
          const filename = `saga-animatic-${dashId}.${ext}`;
          sources.push({
            filename,
            kind: "remote",
            url: outClean,
            contentType: contentTypeFromFilename(filename) ?? "video/mp4",
          });
        }
      } else {
        const objectPath = outClean.replace(/^\/+/, "");
        if (await objectExists(supabase, "exports", objectPath)) {
          const ext = extOf(objectPath) ?? "mp4";
          const filename =
            ext === "json"
              ? `saga-animatic-${dashId}-manifest.json`
              : `saga-animatic-${dashId}.${ext}`;
          sources.push({
            filename,
            kind: "storage",
            bucket: "exports",
            objectPath,
            contentType: contentTypeFromFilename(filename),
          });
        }
      }
    }
  } else if (row.type === "audio_script") {
    const urls = parseNarrationOutputUrls(row.output_url);

    if (urls.length === 0) {
      // Last-resort: a directory listing in case process-export uploaded files
      // but failed to update output_url with the JSON array.
      const { data } = await supabase.storage
        .from("audio")
        .list(id, { limit: 100 });
      const fileNames = (data ?? []).map((f) => f.name).sort();
      fileNames.forEach((name, idx) => {
        const filename =
          fileNames.length <= 1
            ? `saga-narration-${compactId}.wav`
            : `saga-narration-${compactId}-${idx + 1}.wav`;
        sources.push({
          filename,
          kind: "storage",
          bucket: "audio",
          objectPath: `${id}/${name}`,
          contentType: "audio/wav",
        });
      });
    } else {
      urls.forEach((rawUrl, idx) => {
        const info = parseSupabaseStorageUrl(rawUrl);
        const filename =
          urls.length <= 1
            ? `saga-narration-${compactId}.wav`
            : `saga-narration-${compactId}-${idx + 1}.wav`;
        const named = guessFilenameFromUrl(rawUrl, filename);

        if (info && (SIGN_BUCKETS as readonly string[]).includes(info.bucket)) {
          sources.push({
            filename: named,
            kind: "storage",
            bucket: info.bucket,
            objectPath: info.objectPath,
            contentType: contentTypeFromFilename(named) ?? "audio/wav",
          });
        } else {
          sources.push({
            filename: named,
            kind: "remote",
            url: rawUrl,
            contentType: contentTypeFromFilename(named) ?? "audio/wav",
          });
        }
      });
    }
  }

  // Final, never-empty fallback: if nothing matched but output_url is HTTPS,
  // surface it as a remote source so the proxy can stream it.
  if (sources.length === 0 && outClean && /^https?:\/\//i.test(outClean)) {
    const ext = extOf(stripQuery(outClean)) ?? "bin";
    const filename = `saga-export-${dashId}.${ext}`;
    sources.push({
      filename,
      kind: "remote",
      url: outClean,
      contentType: contentTypeFromFilename(filename),
    });
  }

  return sources;
}

/**
 * Lightweight version used by the JSON list endpoint — produces HTTPS URLs
 * (signed when the source lives in a known Supabase bucket).
 */
export async function resolveExportArtifacts(
  supabase: SupabaseClient<Database>,
  row: Pick<
    Database["public"]["Tables"]["exports"]["Row"],
    "id" | "type" | "status" | "output_url"
  >,
): Promise<ResolvedExportArtifact[]> {
  const sources = await resolveExportSources(supabase, row);
  const out: ResolvedExportArtifact[] = [];
  for (const s of sources) {
    if (s.kind === "storage") {
      const signed = await signedUrlForObject(
        supabase,
        s.bucket,
        s.objectPath,
      );
      if (signed) out.push({ filename: s.filename, url: signed });
    } else {
      out.push({ filename: s.filename, url: s.url });
    }
  }
  const seen = new Set<string>();
  return out.filter((f) => {
    const key = `${f.filename}|${f.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
