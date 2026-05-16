/**
 * Shared admin Supabase client for Edge Functions.
 *
 * Initialization is **lazy** — the client is only constructed on the first
 * request. This avoids the previous failure mode where a missing secret
 * caused the module to throw at import time, which surfaces as an opaque
 * 500/503 from the Functions runtime and crashes the worker on every
 * cold start. With a lazy getter, a misconfigured deployment can still
 * boot and return a clean JSON error from the request handler.
 */
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"

function resolveAdminKey(): string | undefined {
  const secretKeysRaw = Deno.env.get("SUPABASE_SECRET_KEYS")
  if (secretKeysRaw) {
    try {
      const secretKeys = JSON.parse(secretKeysRaw) as Record<string, string>
      if (secretKeys.default) return secretKeys.default
    } catch {
      // Fall through to single-key env vars.
    }
  }

  return (
    Deno.env.get("SUPABASE_SECRET_KEY") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_SB_KEY")
  )
}

let cached: SupabaseClient | null = null

/**
 * Returns a memoized admin Supabase client.
 *
 * Throws a descriptive Error when no admin key is configured — callers
 * should catch this in their request handler and respond with 500/503 so
 * the function does not crash on cold start.
 */
export function getAdminClient(): SupabaseClient {
  if (cached) return cached

  const url = Deno.env.get("SUPABASE_URL")
  if (!url) {
    throw new Error("Missing SUPABASE_URL in Edge Function env")
  }

  const adminKey = resolveAdminKey()
  if (!adminKey) {
    throw new Error(
      "Missing Supabase admin key (set SUPABASE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY, or SUPABASE_SB_KEY as an Edge Function secret)",
    )
  }

  cached = createClient(url, adminKey)
  return cached
}
