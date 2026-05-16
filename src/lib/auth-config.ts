/**
 * Auth feature flags and dev-bypass guards (server-only secrets stay in env, not here).
 */

import { timingSafeEqual } from "crypto";

/** Vercel production only — preview builds still set NODE_ENV=production. */
export function isVercelProductionDeployment(): boolean {
  return process.env.VERCEL_ENV === "production";
}

export function isLocalDevelopment(): boolean {
  return process.env.NODE_ENV === "development";
}

export function isDevBypassEnabled(): boolean {
  if (process.env.AUTH_DEV_BYPASS_ENABLED !== "true") return false;
  if (!process.env.AUTH_DEV_BYPASS_SECRET?.trim()) return false;

  if (
    isVercelProductionDeployment() &&
    process.env.AUTH_DEV_BYPASS_ALLOW_PRODUCTION !== "true"
  ) {
    return false;
  }

  return true;
}

/** Login UI: dev bypass without typing secret on `npm run dev` only. */
export function isDevBypassLocalShortcut(): boolean {
  if (!isDevBypassEnabled()) return false;
  return isLocalDevelopment();
}

/** Preview / Vercel production require ?key= or form secret. */
export function devBypassRequiresKey(): boolean {
  if (!isDevBypassEnabled()) return false;
  return !isLocalDevelopment();
}

export function isDevBypassSecretValid(provided: string | null): boolean {
  const expected = process.env.AUTH_DEV_BYPASS_SECRET ?? "";
  if (!provided || !expected) return false;

  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function getDevBypassEmail(): string {
  return process.env.DEV_BYPASS_EMAIL?.trim() || "dev@sagasandbox.local";
}
