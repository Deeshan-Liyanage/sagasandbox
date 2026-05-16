"use client";

import { useCallback, useEffect, useState } from "react";
import { History, Loader2, X } from "lucide-react";
import { readApiError } from "@/lib/project-api";
import { toastError, toastSuccess } from "@/store/toast-store";

interface SnapshotRow {
  id: string;
  change_description: string | null;
  created_at: string;
}

interface HistorySidebarProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onReverted: () => void;
}

export function HistorySidebar({
  projectId,
  open,
  onClose,
  onReverted,
}: HistorySidebarProps) {
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [revertingId, setRevertingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/snapshots`);
      if (!res.ok) throw new Error(await readApiError(res, "Failed to load history"));
      const { snapshots: rows } = (await res.json()) as { snapshots: SnapshotRow[] };
      setSnapshots(rows);
    } catch (err) {
      toastError(err instanceof Error ? err.message : "History unavailable");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      void load();
    });
    return () => cancelAnimationFrame(frame);
  }, [open, load]);

  async function handleRevert(snapshotId: string) {
    if (!confirm("Revert workspace to this snapshot? Current unsaved canvas strokes may be lost.")) {
      return;
    }
    setRevertingId(snapshotId);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/snapshots/${snapshotId}/revert`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error(await readApiError(res, "Revert failed"));
      toastSuccess("Workspace reverted — reloading…");
      onReverted();
      onClose();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Revert failed");
    } finally {
      setRevertingId(null);
    }
  }

  if (!open) return null;

  return (
    <aside className="fixed right-0 top-[52px] z-40 flex h-[calc(100vh-52px)] w-72 flex-col border-l border-[#2a2a2e] bg-[#1a1a1e] shadow-xl">
      <div className="flex items-center justify-between border-b border-[#2a2a2e] px-3 py-2">
        <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[#9ca3af]">
          <History className="h-3.5 w-3.5" />
          Version history
        </span>
        <button type="button" onClick={onClose} className="text-[#9ca3af] hover:text-white">
          <X className="h-4 w-4" />
        </button>
        </div>
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <Loader2 className="mx-auto mt-8 h-5 w-5 animate-spin text-[#7c3aed]" />
        ) : snapshots.length === 0 ? (
          <p className="px-2 py-4 text-xs text-[#9ca3af]">No snapshots yet.</p>
        ) : (
          <ul className="space-y-1">
            {snapshots.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  disabled={revertingId === s.id}
                  onClick={() => void handleRevert(s.id)}
                  className="w-full rounded-lg border border-transparent px-2 py-2 text-left text-xs hover:border-[#7c3aed]/40 hover:bg-[#252528] disabled:opacity-50"
                >
                  <p className="font-medium text-[#e5e7eb]">
                    {s.change_description ?? "Snapshot"}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] text-[#9ca3af]">
                    {new Date(s.created_at).toLocaleString()}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
