import { NextResponse } from "next/server";

import {
  getDevBypassEmail,
  isDevBypassEnabled,
} from "@/lib/auth-config";
import { createAdminClient } from "@/lib/supabase-admin";
import { isSupabaseConfigured } from "@/lib/supabase-env";

/**
 * Instantly signs in a fixed dev user via admin magic link (no email sent).
 * Enable with AUTH_DEV_BYPASS_ENABLED=true + AUTH_DEV_BYPASS_SECRET in .env.local.
 * On production, also requires ?key=<AUTH_DEV_BYPASS_SECRET> unless disabled entirely.
 */
export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 503 },
    );
  }

  if (!isDevBypassEnabled()) {
    return NextResponse.json({ error: "Dev bypass is disabled" }, { status: 403 });
  }

  const url = new URL(request.url);
  const next = url.searchParams.get("next") ?? "/projects";
  const providedKey = url.searchParams.get("key");

  const isProduction =
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production";

  if (isProduction) {
    if (providedKey !== process.env.AUTH_DEV_BYPASS_SECRET) {
      return NextResponse.json({ error: "Invalid dev bypass key" }, { status: 403 });
    }
  } else if (process.env.NODE_ENV !== "development") {
    // Preview / staging: require explicit key
    if (providedKey !== process.env.AUTH_DEV_BYPASS_SECRET) {
      return NextResponse.json({ error: "Invalid dev bypass key" }, { status: 403 });
    }
  }

  const origin = url.origin;
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
  const email = getDevBypassEmail();

  try {
    const admin = createAdminClient();

    const { error: createError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (
      createError &&
      !/already|registered|exists/i.test(createError.message)
    ) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    });

    if (error || !data.properties?.action_link) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to generate dev sign-in link" },
        { status: 500 },
      );
    }

    return NextResponse.redirect(data.properties.action_link);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Dev bypass failed",
      },
      { status: 500 },
    );
  }
}
