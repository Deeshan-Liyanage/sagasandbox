"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { AESTHETIC_STYLES, THEMES } from "@/lib/constants";
import { readApiError } from "@/lib/project-api";
import { toastError, toastSuccess } from "@/store/toast-store";
import type { Project } from "@/types/app";

interface ProjectSettingsModalProps {
  project: Project;
  open: boolean;
  onClose: () => void;
  onProjectUpdated: (project: Project) => void;
}

export function ProjectSettingsModal({
  project,
  open,
  onClose,
  onProjectUpdated,
}: ProjectSettingsModalProps) {
  const [theme, setTheme] = useState(project.theme);
  const [aesthetic, setAesthetic] = useState(project.aesthetic_style);
  const [cascade, setCascade] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme,
          aesthetic_style: aesthetic,
          cascade,
        }),
      });
      if (!res.ok) {
        throw new Error(await readApiError(res, "Failed to save settings"));
      }
      const { project: updated, queued } = (await res.json()) as {
        project: Project;
        queued?: number;
      };
      onProjectUpdated(updated);
      toastSuccess(
        cascade && queued
          ? `Theme updated — ${queued} assets queued for regeneration`
          : "Project settings saved",
      );
      onClose();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="presentation">
      <form
        onSubmit={handleSave}
        className="w-full max-w-md rounded-xl border border-[#2a2a2e] bg-[#1a1a1e] p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Universe settings</h2>
          <button type="button" onClick={onClose} className="text-[#9ca3af] hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="mb-3 block text-xs text-[#9ca3af]">
          Theme
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="mt-1 w-full rounded border border-[#2a2a2e] bg-[#0e0e0f] px-2 py-1.5 text-sm text-white"
          >
            {THEMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <label className="mb-4 block text-xs text-[#9ca3af]">
          Aesthetic
          <select
            value={aesthetic}
            onChange={(e) => setAesthetic(e.target.value)}
            className="mt-1 w-full rounded border border-[#2a2a2e] bg-[#0e0e0f] px-2 py-1.5 text-sm text-white"
          >
            {AESTHETIC_STYLES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>

        <label className="mb-4 flex items-center gap-2 text-xs text-[#e5e7eb]">
          <input
            type="checkbox"
            checked={cascade}
            onChange={(e) => setCascade(e.target.checked)}
            className="rounded border-[#2a2a2e]"
          />
          Regenerate all pin & event visuals (cascade)
        </label>

        <button
          type="submit"
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#7c3aed] py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save changes
        </button>
      </form>
    </div>
  );
}
