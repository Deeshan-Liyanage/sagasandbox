import { redirect } from "next/navigation";

import { LoginForm } from "@/app/login/LoginForm";
import {
  isDevBypassEnabled,
  isDevBypassLocalShortcut,
} from "@/lib/auth-config";
import { isSupabaseConfigured } from "@/lib/supabase-env";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  if (!isSupabaseConfigured()) {
    redirect("/projects/demo");
  }

  const params = await searchParams;
  const nextPath = params.next ?? "/projects";
  const showDevBypass = isDevBypassEnabled();
  const devBypassUsesKey = showDevBypass && !isDevBypassLocalShortcut();

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0e0e0f] px-4">
      <div className="w-full max-w-md rounded-xl border border-[#2a2a2e] bg-[#1a1a1e] p-8">
        <h1 className="mb-2 text-center text-xl font-semibold text-[#e5e7eb]">
          SagaSandbox
        </h1>
        <p className="mb-6 text-center text-sm text-[#9ca3af]">
          Sign in to your universe
        </p>
        {params.error ? (
          <p className="mb-4 text-center text-sm text-red-400">{params.error}</p>
        ) : null}
        <LoginForm
          nextPath={nextPath}
          showDevBypass={showDevBypass}
          devBypassUsesKey={devBypassUsesKey}
        />
      </div>
    </main>
  );
}
