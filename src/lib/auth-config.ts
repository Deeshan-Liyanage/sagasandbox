/**
 * Auth feature flags and dev-bypass guards (server-only secrets stay in env, not here).
 */

export function isDevBypassEnabled(): boolean {
  if (process.env.AUTH_DEV_BYPASS_ENABLED !== "true") return false;
  if (!process.env.AUTH_DEV_BYPASS_SECRET?.trim()) return false;

  const isProduction =
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production";

  if (isProduction && process.env.AUTH_DEV_BYPASS_ALLOW_PRODUCTION !== "true") {
    return false;
  }

  return true;
}

/** Shown on login page — dev bypass allowed without query key on local dev host. */
export function isDevBypassLocalShortcut(): boolean {
  if (!isDevBypassEnabled()) return false;
  return process.env.NODE_ENV === "development";
}

export function getDevBypassEmail(): string {
  return process.env.DEV_BYPASS_EMAIL?.trim() || "dev@sagasandbox.local";
}
