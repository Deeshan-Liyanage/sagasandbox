"use client";

import { useToastStore } from "@/store/toast-store";
import { cn } from "@/lib/cn";

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-24 right-4 z-[100] flex max-w-sm flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto rounded-lg border px-4 py-2 text-sm shadow-lg backdrop-blur",
            t.variant === "error"
              ? "border-[#ef4444]/40 bg-[#1a1a1e]/95 text-[#fca5a5]"
              : "border-[#2a2a2e] bg-[#1a1a1e]/95 text-[#e5e7eb]",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <p>{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="shrink-0 text-[#9ca3af] hover:text-white"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
