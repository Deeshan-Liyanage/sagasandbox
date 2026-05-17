"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Loader2, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { MAX_PROMPT_OVERRIDE_CHARS } from "@/lib/scenery-synthesize-request";
import { toastError, toastSuccess } from "@/store/toast-store";

export interface SceneryPromptPreviewModalProps {
  open: boolean;
  loading: boolean;
  /** Server-built default prompt shown when preview loads. */
  defaultPrompt: string | null;
  warnings: string[];
  confirming: boolean;
  onClose: () => void;
  onConfirm: (editedPrompt: string) => void;
}

export function SceneryPromptPreviewModal({
  open,
  loading,
  defaultPrompt,
  warnings,
  confirming,
  onClose,
  onConfirm,
}: SceneryPromptPreviewModalProps) {
  const [editedPrompt, setEditedPrompt] = useState(() => defaultPrompt ?? "");

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !confirming) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, confirming, onClose]);

  const trimmed = editedPrompt.trim();
  const isEmpty = trimmed.length === 0;
  const overLimit = editedPrompt.length > MAX_PROMPT_OVERRIDE_CHARS;

  const handleCopy = useCallback(async () => {
    if (!trimmed) return;
    try {
      await navigator.clipboard.writeText(editedPrompt);
      toastSuccess("Prompt copied to clipboard");
    } catch {
      toastError("Could not copy prompt");
    }
  }, [editedPrompt, trimmed]);

  const handleConfirm = useCallback(() => {
    if (isEmpty || overLimit || loading || confirming) return;
    onConfirm(trimmed);
  }, [isEmpty, overLimit, loading, confirming, onConfirm, trimmed]);

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
              Edit the full prompt sent to the image model, then confirm or
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
            <textarea
              value={editedPrompt}
              onChange={(e) => setEditedPrompt(e.target.value)}
              disabled={confirming}
              rows={14}
              spellCheck
              className={cn(
                "max-h-[50vh] w-full resize-y rounded-lg border border-[#2a2a2e] bg-[#0f0f12] p-3 font-mono text-xs leading-relaxed text-[#e5e7eb] outline-none focus:border-[#7c3aed]/60",
                confirming && "cursor-not-allowed opacity-60",
              )}
              aria-label="Scenery synthesis prompt"
            />
          )}
          {!loading ? (
            <p
              className={cn(
                "mt-2 text-right font-mono text-[10px]",
                overLimit ? "text-red-400" : "text-[#6b7280]",
              )}
            >
              {editedPrompt.length.toLocaleString()} /{" "}
              {MAX_PROMPT_OVERRIDE_CHARS.toLocaleString()}
            </p>
          ) : null}
          {!loading && isEmpty ? (
            <p className="mt-1 text-xs text-amber-400/90">
              Prompt cannot be empty — restore text or cancel.
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#2a2a2e] px-4 py-3">
          <button
            type="button"
            onClick={() => void handleCopy()}
            disabled={loading || isEmpty}
            className={cn(
              "mr-auto inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-[#9ca3af] hover:bg-[#0f0f12] hover:text-white",
              (loading || isEmpty) && "cursor-not-allowed opacity-50",
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
            onClick={handleConfirm}
            disabled={loading || confirming || isEmpty || overLimit}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md bg-[#7c3aed] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#6d28d9]",
              (loading || confirming || isEmpty || overLimit) &&
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
