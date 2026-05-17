"use client";

import { useCallback, useEffect } from "react";
import { Copy, Loader2, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { toastError, toastSuccess } from "@/store/toast-store";

export interface SceneryPromptPreviewModalProps {
  open: boolean;
  loading: boolean;
  prompt: string | null;
  warnings: string[];
  confirming: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function SceneryPromptPreviewModal({
  open,
  loading,
  prompt,
  warnings,
  confirming,
  onClose,
  onConfirm,
}: SceneryPromptPreviewModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !confirming) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, confirming, onClose]);

  const handleCopy = useCallback(async () => {
    if (!prompt?.trim()) return;
    try {
      await navigator.clipboard.writeText(prompt);
      toastSuccess("Prompt copied to clipboard");
    } catch {
      toastError("Could not copy prompt");
    }
  }, [prompt]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scenery-prompt-preview-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !confirming && !loading) onClose();
      }}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-[#2a2a2e] bg-[#1a1a1e] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#2a2a2e] px-4 py-3">
          <div>
            <h2
              id="scenery-prompt-preview-title"
              className="text-sm font-semibold text-[#e5e7eb]"
            >
              Scenery synthesis prompt
            </h2>
            <p className="mt-0.5 text-xs text-[#9ca3af]">
              Review the full prompt sent to the image model, then confirm or
              cancel.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={confirming || loading}
            className="rounded-md p-1 text-[#9ca3af] hover:bg-[#0f0f12] hover:text-white disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {warnings.length > 0 ? (
          <ul className="border-b border-[#2a2a2e] px-4 py-2 text-xs text-amber-400/90">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        ) : null}

        <div className="min-h-0 flex-1 overflow-hidden px-4 py-3">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-[#9ca3af]">
              <Loader2 className="h-4 w-4 animate-spin text-[#7c3aed]" />
              Building prompt preview…
            </div>
          ) : (
            <pre className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-[#2a2a2e] bg-[#0f0f12] p-3 font-mono text-xs leading-relaxed text-[#e5e7eb]">
              {prompt ?? "No prompt available."}
            </pre>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#2a2a2e] px-4 py-3">
          <button
            type="button"
            onClick={() => void handleCopy()}
            disabled={loading || !prompt?.trim()}
            className={cn(
              "mr-auto inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-[#9ca3af] hover:bg-[#0f0f12] hover:text-white",
              (loading || !prompt?.trim()) && "cursor-not-allowed opacity-50",
            )}
          >
            <Copy className="h-3.5 w-3.5" />
            Copy
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={confirming || loading}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-[#9ca3af] hover:bg-[#0f0f12] hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading || confirming || !prompt}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md bg-[#7c3aed] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#6d28d9]",
              (loading || confirming || !prompt) &&
                "cursor-not-allowed opacity-60",
            )}
          >
            {confirming ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Queuing…
              </>
            ) : (
              "Confirm & synthesize"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
