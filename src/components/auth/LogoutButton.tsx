"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase-client";
import { isSupabaseConfigured } from "@/lib/supabase-env";

export interface LogoutButtonProps {
  className?: string;
  /** Visible label; omit for icon-only control */
  label?: string;
  iconOnly?: boolean;
}

export function LogoutButton({
  className,
  label = "Sign out",
  iconOnly = false,
}: LogoutButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (!isSupabaseConfigured()) {
    return null;
  }

  async function handleSignOut() {
    if (loading) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (error) {
        setLoading(false);
        return;
      }
      router.push("/login");
      router.refresh();
    } catch {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleSignOut()}
      disabled={loading}
      title={iconOnly ? label : undefined}
      aria-label={iconOnly ? label : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-[#2a2a2e] bg-[#1a1a1e] px-2.5 py-1.5 text-xs font-medium text-[#9ca3af] transition hover:border-[#7c3aed]/40 hover:text-white disabled:opacity-50",
        className,
      )}
    >
      <LogOut className="h-3.5 w-3.5 shrink-0" />
      {!iconOnly ? <span>{loading ? "Signing out…" : label}</span> : null}
    </button>
  );
}
