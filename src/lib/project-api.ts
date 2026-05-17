import { DEMO_PROJECT_ID } from "@/lib/mock-workspace";
import { isSupabaseConfigured } from "@/lib/supabase-env";

export const PROJECT_API_UNAVAILABLE_MESSAGE =
  "Connect Supabase to save changes to this project.";

/** True when REST project routes are expected to be available. */
export function isProjectApiAvailable(projectId?: string): boolean {
  if (!isSupabaseConfigured()) return false;
  if (projectId === DEMO_PROJECT_ID) return false;
  return true;
}

export async function readApiError(
  res: Response,
  fallback: string,
): Promise<string> {
  const text = await res.text();

  try {
    const body = JSON.parse(text) as { error?: string; message?: string };
    if (typeof body.error === "string" && body.error.length > 0) {
      return body.error;
    }
    if (typeof body.message === "string" && body.message.length > 0) {
      return body.message;
    }
  } catch {
    // Proxies/CDNs sometimes return HTML for 404/502 — JSON parse fails intentionally.
  }

  const sniff = text.trimStart();
  const nonJsonHint =
    sniff.startsWith("<") || sniff.includes("<!DOCTYPE")
      ? " The server replied with HTML instead of JSON (often a stale deploy or blocked API route)."
      : "";

  if (res.status === 404) {
    return `${fallback}: not found (404).${nonJsonHint} Refresh the Export list or reload the workspace.`;
  }

  return nonJsonHint ? `${fallback}.${nonJsonHint}` : fallback;
}
