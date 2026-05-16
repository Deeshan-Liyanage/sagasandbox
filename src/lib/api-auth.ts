import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db";
import type { User } from "@supabase/supabase-js";

// Fixed owner ID used when there is no authenticated session.
// This must match the user in auth.users so FK constraints and RLS
// behave consistently when the admin client is used.
const ANON_OWNER_ID =
  process.env.DEMO_OWNER_ID ?? "eac9dabe-f691-4368-b1d3-7d327d89fb42";

type AuthContext = {
  user: User;
  supabase: SupabaseClient<Database>;
};

/**
 * Returns an admin Supabase client (bypasses RLS) and a stub user object.
 * Auth is disabled for the buildathon — no login is required.
 */
export async function requireAuth(): Promise<AuthContext | NextResponse> {
  const supabase = createAdminClient() as unknown as SupabaseClient<Database>;
  const user = { id: ANON_OWNER_ID } as User;
  return { user, supabase };
}

export function isAuthError(
  result: AuthContext | NextResponse,
): result is NextResponse {
  return result instanceof NextResponse;
}

export function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}
