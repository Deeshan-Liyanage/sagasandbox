const PUBLIC_PREFIX = "/storage/v1/object/public/";
const SIGN_PREFIX = "/storage/v1/object/sign/";

function decodeSeg(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, " "));
  } catch {
    return s;
  }
}

/**
 * Parses a Supabase Storage absolute URL (`public` bucket URL or `/object/sign/` link)
 * into `{ bucket, objectPath }` for `storage.from(bucket).createSignedUrl(objectPath, …)`.
 */
export function parseSupabaseStorageObjectRef(
  absoluteUrl: string,
): { bucket: string; objectPath: string } | null {
  try {
    const u = new URL(absoluteUrl);
    let rest: string | null = null;

    let idx = u.pathname.indexOf(PUBLIC_PREFIX);
    if (idx !== -1) rest = u.pathname.slice(idx + PUBLIC_PREFIX.length);
    else {
      idx = u.pathname.indexOf(SIGN_PREFIX);
      if (idx !== -1) rest = u.pathname.slice(idx + SIGN_PREFIX.length);
    }
    if (!rest) return null;

    const slash = rest.indexOf("/");
    if (slash < 1) return null;

    const bucket = decodeSeg(rest.slice(0, slash));
    const rawObject = rest.slice(slash + 1);
    if (!bucket || !rawObject) return null;

    const objectPath = decodeSeg(rawObject);
    return objectPath ? { bucket, objectPath } : null;
  } catch {
    return null;
  }
}

export function normalizeUuidParam(raw: string): string {
  return raw.trim().toLowerCase().replace(/^"+|"+$/g, "").replace(/^'+|'+$/g, "");
}
