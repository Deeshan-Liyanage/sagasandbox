"use client";

import { useState } from "react";
import type { LocationPin } from "@/types/app";
import {
  PROJECT_API_UNAVAILABLE_MESSAGE,
  readApiError,
} from "@/lib/project-api";

interface PinCreatorProps {
  projectId: string;
  canvasX: number;
  canvasY: number;
  apiAvailable?: boolean;
  onCreated: (pin: LocationPin) => void;
  onCancel: () => void;
}

export function PinCreator({
  projectId,
  canvasX,
  canvasY,
  apiAvailable = true,
  onCreated,
  onCancel,
}: PinCreatorProps) {
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!apiAvailable) {
      setError(PROJECT_API_UNAVAILABLE_MESSAGE);
      return;
    }
    if (!label.trim()) {
      setError("Label is required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/pins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim(),
          description: description.trim() || null,
          canvas_x: canvasX,
          canvas_y: canvasY,
        }),
      });
      if (!res.ok) {
        throw new Error(await readApiError(res, "Failed to create pin"));
      }
      const { pin } = (await res.json()) as { pin: LocationPin };
      onCreated(pin);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create pin");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="absolute left-1/2 top-1/2 z-20 w-72 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-[#2a2a2e] bg-[#1a1a1e] p-4 shadow-xl"
    >
      <p className="mb-3 text-sm font-medium text-white">New location pin</p>
      <input
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="The Whispering Tavern"
        className="mb-2 w-full rounded border border-[#2a2a2e] bg-[#0e0e0f] px-2 py-1.5 text-sm text-white outline-none focus:border-[#7c3aed]"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Describe this location…"
        rows={3}
        className="mb-3 w-full resize-none rounded border border-[#2a2a2e] bg-[#0e0e0f] px-2 py-1.5 text-sm text-white outline-none focus:border-[#7c3aed]"
      />
      {error ? (
        <p className="mb-2 text-xs text-[#ef4444]">{error}</p>
      ) : null}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded px-2 py-1 text-xs text-[#9ca3af] hover:text-white"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || !apiAvailable}
          className="rounded bg-[#7c3aed] px-3 py-1 text-xs font-medium text-white disabled:opacity-60"
        >
          {loading ? "Adding…" : "Add pin"}
        </button>
      </div>
    </form>
  );
}
