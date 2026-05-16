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
