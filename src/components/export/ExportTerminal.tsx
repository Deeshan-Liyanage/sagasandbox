"use client";

import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import type { Export, ExportType, TimelineEvent } from "@/types/app";
import { RemoteImage } from "@/components/shared/RemoteImage";
import {
  type NamedDownloadLink,
  downloadNamedArtifactsSequential,
} from "@/lib/export-download";
import { cn } from "@/lib/cn";
import {
  PROJECT_API_UNAVAILABLE_MESSAGE,
  readApiError,
} from "@/lib/project-api";
import { toastError, toastSuccess } from "@/store/toast-store";

interface ExportTerminalProps {
  projectId: string;
  events: TimelineEvent[];
  apiAvailable?: boolean;
  onExportUpdate?: (exp: Export) => void;
  liveExport?: Export | null;
  realtimeActive?: boolean;
}

const EXPORT_TYPES: { id: ExportType; label: string }[] = [
  { id: "storyboard_pdf", label: "Storyboard bundle (JSON)" },
  { id: "audio_script", label: "Narration audio (Kokoro)" },
  { id: "animatic_video", label: "Animatic video (Luma → MP4)" },
];

const TYPE_LABELS: Record<ExportType, string> = {
  storyboard_pdf: "Storyboard",
  audio_script: "Narration",
  animatic_video: "Animatic",
};

function progressWidth(status: Export["status"] | null) {
  switch (status) {
    case "queued":
      return "10%";
    case "processing":
      return "50%";
    case "done":
      return "100%";
    default:
      return "0%";
  }
}

function exportTypeBadge(type: string): ExportType | null {
  if (type === "storyboard_pdf" || type === "audio_script" || type === "animatic_video") {
    return type;
  }
  return null;
}

/** `MM/DD, HH:mm` — compact terminal log style */
function formatExportTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function ExportTerminal({
  projectId,
  events,
  apiAvailable = true,
  onExportUpdate,
  liveExport = null,
  realtimeActive = false,
}: ExportTerminalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exportType, setExportType] = useState<ExportType>("storyboard_pdf");
  const [currentExportId, setCurrentExportId] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<Export["status"] | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [recentExports, setRecentExports] = useState<Export[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const realtimeExport =
    liveExport && currentExportId && liveExport.id === currentExportId
      ? liveExport
      : null;
  const displayStatus = realtimeExport?.status ?? exportStatus;
  const displayError =
    realtimeExport?.status === "error" ? "Export failed" : error;
  const terminalExportDone =
    Boolean(currentExportId) &&
    (realtimeExport?.status === "done" || exportStatus === "done");

  function toggleEvent(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const loadRecentExports = useCallback(async () => {
    if (!apiAvailable) return;
    setRecentLoading(true);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/exports`);
      if (!res.ok) {
        throw new Error(await readApiError(res, "Could not load exports"));
      }
      const data = (await res.json()) as { exports: Export[] };
      setRecentExports(data.exports ?? []);
    } catch {
      // Non-fatal: terminal still queues new exports
    } finally {
      setRecentLoading(false);
    }
  }, [projectId, apiAvailable]);

  useEffect(() => {
    void Promise.resolve()
      .then(() => loadRecentExports())
      .catch(() => undefined);
  }, [loadRecentExports]);

  async function startExport() {
    if (!apiAvailable) {
      setError(PROJECT_API_UNAVAILABLE_MESSAGE);
      return;
    }
    if (selected.size === 0) {
      setError("Select at least one event");
      return;
    }
    setSubmitting(true);
    setError(null);
    setExportStatus(null);
    setCurrentExportId(null);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/exports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: exportType,
          event_ids: Array.from(selected),
        }),
      });
      if (!res.ok) {
        throw new Error(await readApiError(res, "Export failed to start"));
      }
      const { export: exp } = (await res.json()) as { export: Export };
      setCurrentExportId(exp.id);
      setExportStatus(exp.status);
      onExportUpdate?.(exp);
      void loadRecentExports();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Export failed";
      setError(message);
      toastError(message);
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (!currentExportId) return;
    if (
      realtimeExport?.status === "done" ||
      realtimeExport?.status === "error"
    ) {
      return;
    }

    const pollMs = realtimeActive ? 5000 : 2000;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/exports/${encodeURIComponent(currentExportId)}`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          export: Export;
          signed_url?: string;
          artifacts?: NamedDownloadLink[];
        };
        setExportStatus(data.export.status);
        onExportUpdate?.(data.export);
        if (data.export.status === "done" || data.export.status === "error") {
          clearInterval(interval);
        }
      } catch {
        // ignore poll errors
      }
    }, pollMs);

    return () => clearInterval(interval);
  }, [
    currentExportId,
    projectId,
    onExportUpdate,
    realtimeActive,
    realtimeExport?.status,
  ]);

  async function handleDownloadById(expId: string) {
    if (!apiAvailable) return;
    setDownloadingId(expId);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/exports/${encodeURIComponent(expId)}`);
      if (!res.ok) {
        toastError(await readApiError(res, "Download lookup failed"));
        return;
      }
      const data = (await res.json()) as {
        export: Export;
        signed_url?: string;
        artifacts?: NamedDownloadLink[];
      };
      const exp = data.export;
      if (exp.status !== "done") return;

      const artifacts = (data.artifacts ?? []).filter(
        (a) => a?.url?.trim() && a?.filename?.trim(),
      );
      if (artifacts.length === 0) {
        toastError(
          "This export finished but no files were resolved. Try Refresh or regenerate the export.",
        );
        return;
      }
      await downloadNamedArtifactsSequential(artifacts);
      toastSuccess(
        artifacts.length === 1
          ? `Saved "${artifacts[0].filename}".`
          : `Saved ${artifacts.length} files to your Downloads folder.`,
      );
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleDownloadCurrent() {
    if (!currentExportId || !terminalExportDone) return;
    await handleDownloadById(currentExportId);
  }

  return (
    <div className="space-y-4 p-1">
      <h3 className="text-sm font-semibold text-white">Export Terminal</h3>

      {!apiAvailable ? (
        <p className="text-xs text-[#9ca3af]">{PROJECT_API_UNAVAILABLE_MESSAGE}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {EXPORT_TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setExportType(t.id)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium",
              exportType === t.id
                ? "border-[#7c3aed] bg-[#7c3aed]/20 text-white"
                : "border-[#2a2a2e] text-[#9ca3af]",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <ul className="max-h-48 space-y-2 overflow-y-auto">
        {events.map((ev) => (
          <li key={ev.id}>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#2a2a2e] p-2 hover:bg-[#252528]">
              <input
                type="checkbox"
                checked={selected.has(ev.id)}
                onChange={() => toggleEvent(ev.id)}
                className="accent-[#7c3aed]"
              />
              {ev.generated_image_url ? (
                <RemoteImage
                  src={ev.generated_image_url}
                  alt=""
                  width={56}
                  height={40}
                  className="h-10 w-14 rounded object-cover"
                />
              ) : (
                <div className="h-10 w-14 rounded bg-[#252528]" />
              )}
              <span className="truncate text-xs text-white">{ev.title}</span>
            </label>
          </li>
        ))}
      </ul>

      {displayStatus ? (
        <div>
          <div className="mb-1 flex justify-between text-[10px] text-[#9ca3af]">
            <span>Status: {displayStatus}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#252528]">
            <div
              className="h-full bg-[#7c3aed] transition-all duration-500"
              style={{ width: progressWidth(displayStatus) }}
            />
          </div>
        </div>
      ) : null}

      {displayError ? (
        <p className="text-xs text-[#ef4444]">{displayError}</p>
      ) : null}

      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={submitting || selected.size === 0 || !apiAvailable}
          onClick={() => void startExport()}
          className="rounded-lg bg-[#7c3aed] py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitting ? "Starting…" : "Start export"}
        </button>
        {terminalExportDone && currentExportId ? (
          <button
            type="button"
            disabled={downloadingId !== null || !apiAvailable}
            onClick={() => void handleDownloadCurrent()}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#2a2a2e] py-2 text-sm text-white hover:border-[#7c3aed] disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Download export files
          </button>
        ) : null}
      </div>

      <div className="rounded-lg border border-[#2a2a2e] p-3">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-[#9ca3af]">
            Recent exports
          </h4>
          <button
            type="button"
            disabled={!apiAvailable || recentLoading}
            onClick={() => void loadRecentExports()}
            className="text-[10px] text-[#7c3aed] hover:underline disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
        {recentExports.length === 0 && recentLoading ? (
          <p className="text-xs text-[#9ca3af]">Loading…</p>
        ) : recentExports.length === 0 ? (
          <p className="text-xs text-[#9ca3af]">No exports yet.</p>
        ) : (
          <ul className="max-h-40 space-y-1.5 overflow-y-auto">
            {recentExports.map((row) => {
              const t = exportTypeBadge(row.type);
              const label = t ? TYPE_LABELS[t] : row.type;

              return (
                <li
                  key={row.id}
                  className="flex items-center gap-2 text-xs text-white"
                >
                  <span className="truncate font-medium text-[#e5e7eb]">
                    {label}
                  </span>
                  <span className="flex-1 truncate text-[10px] text-[#9ca3af]">
                    {formatExportTime(row.created_at)} ·{" "}
                    <span className="font-mono">{row.status}</span>
                  </span>
                  {row.status === "done" ? (
                    <button
                      type="button"
                      disabled={!apiAvailable || downloadingId !== null}
                      title="Download to your device"
                      onClick={() => void handleDownloadById(row.id)}
                      className="shrink-0 rounded-md border border-[#2a2a2e] px-2 py-1 text-[10px] text-[#10b981] hover:border-[#10b981] disabled:opacity-50"
                    >
                      {downloadingId === row.id ? "Saving…" : "Download"}
                    </button>
                  ) : row.status === "error" ? (
                    <span className="text-[10px] text-[#ef4444]">Failed</span>
                  ) : (
                    <span className="text-[10px] text-[#9ca3af]">
                      Processing…
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
