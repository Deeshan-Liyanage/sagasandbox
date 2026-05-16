import { createBrowserClient } from "@supabase/ssr";

import { isSupabaseConfigured } from "@/lib/supabase-env";

export { isSupabaseConfigured };

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key",
  );
}
