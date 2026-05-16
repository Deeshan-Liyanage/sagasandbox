import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db";

/** Preferred: `SUPABASE_SECRET_KEY` (`sb_secret_...`). Legacy JWT service_role still supported. */
export function getSupabaseAdminKey(): string | undefined {
  return (
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SB_KEY
  );
}

/**
 * Headers for invoking Supabase Edge Functions from Next.js API routes.
 *
 * Both the new `sb_secret_...` keys and the legacy JWT `service_role`
 * (`eyJ...`) keys require the `Authorization: Bearer <key>` header —
 * without it the Functions gateway returns 401 before the function body
 * ever runs. Previously this header was only added for JWT-shaped keys,
 * which silently broke fal.ai webhook forwarding on projects that use
 * the new secret-key format.
 */
export function getEdgeFunctionInvokeHeaders(
  adminKey: string,
): Record<string, string> {
  return {
    "Content-Type": "application/json",
    apikey: adminKey,
    Authorization: `Bearer ${adminKey}`,
  };
}

export function createAdminClient() {
  const adminKey = getSupabaseAdminKey();
  if (!adminKey) {
    throw new Error(
      "Missing Supabase admin key. Set SUPABASE_SECRET_KEY (preferred) or SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    adminKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
