"use client";

import { useState } from "react";
import { Trash2, X } from "lucide-react";
import type { LocationPin } from "@/types/app";
import { asGenStatus } from "@/types/app";
import { GenStatusImage } from "@/components/shared/GenStatusImage";
import {
  PROJECT_API_UNAVAILABLE_MESSAGE,
  readApiError,
} from "@/lib/project-api";

export interface PinSidebarProps {
  pin: LocationPin | null;
  projectId: string;
  apiAvailable?: boolean;
  onClose: () => void;
  onPinUpdated: (pin: LocationPin) => void;
  onPinDeleted?: (pinId: string) => void;
}

export function PinSidebar({
  pin,
  projectId,
  apiAvailable = true,
  onClose,
  onPinUpdated,
  onPinDeleted,
}: PinSidebarProps) {
  const [label, setLabel] = useState(pin?.label ?? "");
  const [description, setDescription] = useState(pin?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!pin) return null;

  const activePin = pin;

  async function patchPin(body: { label?: string; description?: string }) {
    if (!apiAvailable) {
      setError(PROJECT_API_UNAVAILABLE_MESSAGE);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/pins/${activePin.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        throw new Error(await readApiError(res, "Update failed"));
      }
      const { pin: updated } = (await res.json()) as { pin: LocationPin };
      onPinUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleBlur() {
    if (
      label === activePin.label &&
      description === (activePin.description ?? "")
    )
      return;
    await patchPin({ label, description });
  }

  async function handleRetry() {
    await patchPin({
      description: description || activePin.description || "",
    });
  }

  async function handleDelete() {
    if (!apiAvailable) {
      setError(PROJECT_API_UNAVAILABLE_MESSAGE);
      return;
    }
    if (!confirm("Delete this location pin?")) return;
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/pins/${activePin.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        throw new Error(await readApiError(res, "Delete failed"));
      }
      onPinDeleted?.(activePin.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <aside className="fixed inset-y-[52px] right-0 z-30 flex w-[320px] flex-col border-l border-[#2a2a2e] bg-[#1a1a1e] shadow-xl">
      <div className="flex items-center justify-between border-b border-[#2a2a2e] p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[#9ca3af]">
          Location
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-[#9ca3af] hover:text-white"
          aria-label="Close pin panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <GenStatusImage
          status={asGenStatus(activePin.gen_status)}
          imageUrl={activePin.generated_image_url}
          alt={activePin.label}
          onRetry={
            asGenStatus(activePin.gen_status) === "error" ? handleRetry : undefined
          }
        />

        <label className="block">
          <span className="mb-1 block text-xs text-[#9ca3af]">Label</span>
          <input
            type="text"
            value={label}
            disabled={saving || !apiAvailable}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={handleBlur}
            className="w-full rounded border border-[#2a2a2e] bg-[#0e0e0f] px-2 py-1.5 text-sm text-white outline-none focus:border-[#7c3aed]"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-[#9ca3af]">
            Description
          </span>
          <textarea
            value={description}
            disabled={saving || !apiAvailable}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleBlur}
            rows={4}
            className="w-full resize-none rounded border border-[#2a2a2e] bg-[#0e0e0f] px-2 py-1.5 text-sm text-white outline-none focus:border-[#7c3aed]"
          />
        </label>

        {error ? <p className="text-xs text-[#ef4444]">{error}</p> : null}
      </div>

      <div className="border-t border-[#2a2a2e] p-4">
        <button
          type="button"
          onClick={handleDelete}
          disabled={!apiAvailable || saving}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#ef4444]/40 px-3 py-2 text-sm text-[#ef4444] hover:bg-[#ef4444]/10 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
          Delete pin
        </button>
      </div>
    </aside>
  );
}
