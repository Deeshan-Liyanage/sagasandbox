"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-client";

type LoginFormProps = {
  nextPath: string;
  showDevBypass: boolean;
  devBypassUsesKey: boolean;
};

export function LoginForm({
  nextPath,
  showDevBypass,
  devBypassUsesKey,
}: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"idle" | "email" | "google">("idle");
  const [devKey, setDevKey] = useState("");

  const callbackUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback?next=${encodeURIComponent(nextPath)}`;

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading("email");
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl },
    });

    setLoading("idle");
    if (signInError) {
      setError(signInError.message);
      return;
    }
    setSent(true);
  }

  async function handleGoogleSignIn() {
    setLoading("google");
    setError(null);

    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl,
        queryParams: { prompt: "select_account" },
      },
    });

    setLoading("idle");
    if (oauthError) {
      setError(oauthError.message);
    }
  }

  function handleDevBypass() {
    const params = new URLSearchParams({ next: nextPath });
    if (devBypassUsesKey && devKey.trim()) {
      params.set("key", devKey.trim());
    }
    window.location.href = `/api/auth/dev-bypass?${params.toString()}`;
  }

  if (sent) {
    return (
      <p className="text-center text-sm text-[#e5e7eb]">
        Check your email for the magic link.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={loading !== "idle"}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#2a2a2e] bg-[#0e0e0f] px-4 py-2.5 text-sm font-medium text-[#e5e7eb] transition hover:border-[#7c3aed]/50 hover:bg-[#1a1a1e] disabled:opacity-50"
      >
        <GoogleIcon />
        {loading === "google" ? "Redirecting…" : "Continue with Google"}
      </button>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-[#2a2a2e]" />
        <span className="text-xs uppercase tracking-wide text-[#6b7280]">or</span>
        <span className="h-px flex-1 bg-[#2a2a2e]" />
      </div>

      <form onSubmit={handleEmailSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wide text-[#9ca3af]">
            Email
          </span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-[#2a2a2e] bg-[#0e0e0f] px-3 py-2 text-sm text-white outline-none focus:border-[#7c3aed]"
            placeholder="you@studio.com"
          />
        </label>
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <button
          type="submit"
          disabled={loading !== "idle"}
          className="w-full rounded-lg bg-[#7c3aed] px-4 py-2 text-sm font-medium text-white hover:bg-[#6d28d9] disabled:opacity-50"
        >
          {loading === "email" ? "Sending…" : "Send magic link"}
        </button>
      </form>

      {showDevBypass ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-amber-400/90">
            Development sign-in
          </p>
          {devBypassUsesKey ? (
            <input
              type="password"
              value={devKey}
              onChange={(e) => setDevKey(e.target.value)}
              placeholder="Dev bypass secret"
              className="mb-2 w-full rounded-lg border border-[#2a2a2e] bg-[#0e0e0f] px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
              autoComplete="off"
            />
          ) : null}
          <button
            type="button"
            onClick={handleDevBypass}
            disabled={devBypassUsesKey && !devKey.trim()}
            className="w-full rounded-lg border border-amber-500/40 px-3 py-2 text-sm text-amber-200/90 hover:bg-amber-500/10 disabled:opacity-50"
          >
            Sign in as dev user (no email)
          </button>
          <p className="mt-2 text-[10px] leading-relaxed text-[#6b7280]">
            Skips email rate limits. Uses{" "}
            <span className="font-mono text-[#9ca3af]">AUTH_DEV_BYPASS_*</span>{" "}
            env vars — never enable on public production without a secret key.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
