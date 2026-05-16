import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db";
import type { User } from "@supabase/supabase-js";

type AuthContext = {
  user: User;
  supabase: SupabaseClient<Database>;
};

export async function requireAuth(): Promise<AuthContext | NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
