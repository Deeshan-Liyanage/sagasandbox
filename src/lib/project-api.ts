import { isSupabaseConfigured } from "@/lib/supabase-env";

export const PROJECT_API_UNAVAILABLE_MESSAGE =
  "Connect Supabase and sign in to save changes to this project.";

/** True when REST project routes are expected to be available. */
export function isProjectApiAvailable(): boolean {
  return isSupabaseConfigured();
}

export async function readApiError(
  res: Response,
  fallback: string,
): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    if (body.error) return body.error;
  } catch {
    // ignore parse errors
  }
  if (res.status === 404) {
    return "Project API is not available. Check your deployment or sign in.";
  }
  return fallback;
}
