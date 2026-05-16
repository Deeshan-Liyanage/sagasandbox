"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import type { Export, ExportType, TimelineEvent } from "@/types/app";
import { RemoteImage } from "@/components/shared/RemoteImage";
import { cn } from "@/lib/cn";

interface ExportTerminalProps {
  projectId: string;
  events: TimelineEvent[];
  onExportUpdate?: (exp: Export) => void;
}

const EXPORT_TYPES: { id: ExportType; label: string }[] = [
  { id: "storyboard_pdf", label: "Storyboard PDF" },
  { id: "audio_script", label: "Audio Script" },
];

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

export function ExportTerminal({
  projectId,
  events,
  onExportUpdate,
}: ExportTerminalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exportType, setExportType] = useState<ExportType>("storyboard_pdf");
  const [currentExportId, setCurrentExportId] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<Export["status"] | null>(
    null,
  );
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleEvent(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function startExport() {
    if (selected.size === 0) {
      setError("Select at least one event");
      return;
    }
    setSubmitting(true);
    setError(null);
    setDownloadUrl(null);
    setExportStatus(null);
    setCurrentExportId(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/exports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: exportType,
          event_ids: Array.from(selected),
        }),
      });
      if (!res.ok) throw new Error("Export failed to start");
      const { export: exp } = (await res.json()) as { export: Export };
      setCurrentExportId(exp.id);
      setExportStatus(exp.status);
      onExportUpdate?.(exp);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (!currentExportId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/projects/${projectId}/exports/${currentExportId}`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          export: Export;
          signed_url?: string;
        };
        setExportStatus(data.export.status);
        onExportUpdate?.(data.export);
        if (data.export.status === "done") {
          setDownloadUrl(data.signed_url ?? data.export.output_url);
          clearInterval(interval);
        }
        if (data.export.status === "error") {
          setError("Export failed");
          clearInterval(interval);
        }
      } catch {
        // ignore poll errors
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [currentExportId, projectId, onExportUpdate]);

  return (
    <div className="space-y-4 p-1">
      <h3 className="text-sm font-semibold text-white">Export Terminal</h3>

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

      {exportStatus ? (
        <div>
          <div className="mb-1 flex justify-between text-[10px] text-[#9ca3af]">
            <span>Status: {exportStatus}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#252528]">
            <div
              className="h-full bg-[#7c3aed] transition-all duration-500"
              style={{ width: progressWidth(exportStatus) }}
            />
          </div>
        </div>
      ) : null}

      {error ? <p className="text-xs text-[#ef4444]">{error}</p> : null}

      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={submitting || selected.size === 0}
          onClick={startExport}
          className="rounded-lg bg-[#7c3aed] py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitting ? "Starting…" : "Start export"}
        </button>
        {exportStatus === "done" && downloadUrl ? (
          <a
            href={downloadUrl}
            download
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#2a2a2e] py-2 text-sm text-white hover:border-[#7c3aed]"
          >
            <Download className="h-4 w-4" />
            Download
          </a>
        ) : null}
      </div>
    </div>
  );
}
