"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { AESTHETIC_STYLES, THEMES } from "@/lib/constants";
import { cn } from "@/lib/cn";

export interface UniverseInitializerModalProps {
  open: boolean;
  onClose: () => void;
}

export function UniverseInitializerModal({
  open,
  onClose,
}: UniverseInitializerModalProps) {
  const router = useRouter();
  const [projectName, setProjectName] = useState("");
  const [selectedTheme, setSelectedTheme] = useState<string>(THEMES[0].id);
  const [selectedStyle, setSelectedStyle] = useState<string>(
    AESTHETIC_STYLES[0],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleConfirm() {
    if (!projectName.trim()) {
      setError("Project name is required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectName.trim(),
          theme: selectedTheme,
          aesthetic_style: selectedStyle,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? "Failed to create project",
        );
      }
      const { project } = (await res.json()) as { project: { id: string } };
      router.push(`/projects/${project.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="universe-modal-title"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-[#2a2a2e] bg-[#0e0e0f] p-6 shadow-2xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2
              id="universe-modal-title"
              className="text-xl font-semibold text-[#e5e7eb]"
            >
              Initialize your universe
            </h2>
            <p className="mt-1 text-sm text-[#9ca3af]">
              Choose a theme and aesthetic for your story sandbox.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-[#9ca3af] hover:bg-[#1a1a1e] hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="mb-6 block">
          <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-[#9ca3af]">
            Project name
          </span>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="The Obsidian Covenant"
            className="w-full rounded-lg border border-[#2a2a2e] bg-[#1a1a1e] px-3 py-2 text-sm text-white outline-none focus:border-[#7c3aed]"
          />
        </label>

        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[#9ca3af]">
          Theme
        </p>
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelectedTheme(t.id)}
              className={cn(
                "rounded-lg border p-3 text-left transition",
                selectedTheme === t.id
                  ? "border-[#7c3aed] bg-[#1a1a1e]"
                  : "border-[#2a2a2e] bg-[#141416] hover:border-[#3f3f46]",
              )}
              style={
                selectedTheme === t.id
                  ? { boxShadow: `0 0 0 1px ${t.accent}40` }
                  : undefined
              }
            >
              <span className="text-2xl">{t.emoji}</span>
              <span className="mt-2 block text-xs font-medium leading-tight">
                {t.label}
              </span>
            </button>
          ))}
        </div>

        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[#9ca3af]">
          Aesthetic style
        </p>
        <div className="mb-6 flex flex-wrap gap-2">
          {AESTHETIC_STYLES.map((style) => (
            <button
              key={style}
              type="button"
              onClick={() => setSelectedStyle(style)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                selectedStyle === style
                  ? "border-[#7c3aed] bg-[#7c3aed]/20 text-white"
                  : "border-[#2a2a2e] text-[#9ca3af] hover:border-[#3f3f46]",
              )}
            >
              {style}
            </button>
          ))}
        </div>

        {error ? (
          <p className="mb-4 text-sm text-[#ef4444]" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          disabled={loading}
          onClick={handleConfirm}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#7c3aed] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#6d28d9] disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating…
            </>
          ) : (
            "Create universe"
          )}
        </button>
      </div>
    </div>
  );
}
