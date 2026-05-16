import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db";

function getSupabaseAdminKey() {
  return (
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SB_KEY
  );
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
