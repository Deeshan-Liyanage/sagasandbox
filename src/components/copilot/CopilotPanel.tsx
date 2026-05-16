"use client";

import { useState } from "react";
import { Loader2, Send, Sparkles, X } from "lucide-react";
import { readApiError } from "@/lib/project-api";
import { toastError } from "@/store/toast-store";
import type { TimelineEvent } from "@/types/app";

interface CopilotPanelProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onEventsChange: (events: TimelineEvent[]) => void;
  events: TimelineEvent[];
}

export function CopilotPanel({
  projectId,
  open,
  onClose,
  onEventsChange,
  events,
}: CopilotPanelProps) {
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setLoading(true);
    setResponse("");
    try {
      const res = await fetch(`/api/projects/${projectId}/copilot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, propose_changes: true }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "Copilot unavailable"));
      const data = (await res.json()) as {
        response: string;
        pending_id: string | null;
      };
      setResponse(data.response);
      setPendingId(data.pending_id);
      const evRes = await fetch(`/api/projects/${projectId}/events`);
      if (evRes.ok) {
        const { events: fresh } = (await evRes.json()) as { events: TimelineEvent[] };
        onEventsChange(fresh);
      }
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Copilot failed");
    } finally {
      setLoading(false);
    }
  }

  async function handlePending(action: "approve" | "reject") {
    if (!pendingId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/copilot/pending/${pendingId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      if (!res.ok) throw new Error(await readApiError(res, "Action failed"));
      setPendingId(null);
      const evRes = await fetch(`/api/projects/${projectId}/events`);
      if (evRes.ok) {
        const { events: fresh } = (await evRes.json()) as { events: TimelineEvent[] };
        onEventsChange(fresh);
      }
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setLoading(false);
    }
  }

  const ghostCount = events.filter((e) => e.is_ghost).length;

  return (
    <aside className="fixed bottom-4 right-4 z-40 flex h-[min(420px,70vh)] w-80 flex-col rounded-xl border border-[#7c3aed]/40 bg-[#1a1a1e] shadow-2xl">
      <div className="flex items-center justify-between border-b border-[#2a2a2e] px-3 py-2">
        <span className="flex items-center gap-2 text-xs font-medium text-[#a78bfa]">
          <Sparkles className="h-3.5 w-3.5" />
          Creative Copilot
        </span>
        <button type="button" onClick={onClose} className="text-[#9ca3af] hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 text-xs text-[#e5e7eb]">
        {response ? <p className="whitespace-pre-wrap">{response}</p> : (
          <p className="text-[#9ca3af]">
            Ask about plot holes, timeline gaps, or character consistency.
            {ghostCount > 0 ? ` ${ghostCount} ghost node(s) pending approval.` : null}
          </p>
        )}
      </div>

      {pendingId ? (
        <div className="flex gap-2 border-t border-[#2a2a2e] px-3 py-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => void handlePending("approve")}
            className="flex-1 rounded bg-[#10b981] py-1 text-xs font-medium text-white disabled:opacity-50"
          >
            Approve ghost
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => void handlePending("reject")}
            className="flex-1 rounded border border-[#2a2a2e] py-1 text-xs text-[#9ca3af] hover:text-white disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      ) : null}

      <form onSubmit={handleSend} className="flex gap-2 border-t border-[#2a2a2e] p-2">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ask the copilot…"
          className="min-w-0 flex-1 rounded border border-[#2a2a2e] bg-[#0e0e0f] px-2 py-1.5 text-xs text-white"
        />
        <button
          type="submit"
          disabled={loading || !message.trim()}
          className="rounded bg-[#7c3aed] p-2 text-white disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </aside>
  );
}
