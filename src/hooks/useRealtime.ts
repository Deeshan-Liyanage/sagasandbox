"use client";

import { useEffect, useRef } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase-client";
import type {
  Character,
  Export,
  LocationPin,
  TimelineEvent,
} from "@/types/app";

export type CanvasOpType = "add" | "modify" | "delete" | "cursor";

export interface CanvasOpPayload {
  op: CanvasOpType;
  user_id: string;
  object_id: string;
  payload: Record<string, unknown>;
}

export interface ProjectRealtimeHandlers {
  onCanvasOp: (op: CanvasOpPayload) => void;
  onPinUpdate: (pin: LocationPin) => void;
  onPinInsert?: (pin: LocationPin) => void;
  onPinDelete?: (pinId: string) => void;
  onEventUpdate: (event: TimelineEvent) => void;
  onEventInsert?: (event: TimelineEvent) => void;
  onEventDelete?: (eventId: string) => void;
  onExportUpdate: (exp: Export) => void;
  onCharacterUpdate?: (character: Character) => void;
  onCharacterInsert?: (character: Character) => void;
  onCharacterDelete?: (characterId: string) => void;
}

function subscribeTable<T>(
  channel: ReturnType<ReturnType<typeof createClient>["channel"]>,
  table: string,
  projectId: string,
  handlers: {
    onUpdate: (row: T) => void;
    onInsert?: (row: T) => void;
    onDelete?: (id: string) => void;
  },
) {
  channel
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table,
        filter: `project_id=eq.${projectId}`,
      },
      ({ new: row }) => handlers.onUpdate(row as T),
    )
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table,
        filter: `project_id=eq.${projectId}`,
      },
      ({ new: row }) => handlers.onInsert?.(row as T),
    )
    .on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table,
        filter: `project_id=eq.${projectId}`,
      },
      ({ old }) => {
        const id = (old as { id?: string }).id;
        if (id) handlers.onDelete?.(id);
      },
    );
}

export function useProjectRealtime(
  projectId: string,
  handlers: ProjectRealtimeHandlers,
) {
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (!projectId || !isSupabaseConfigured()) return;

    const supabase = createClient();
    const channel = supabase.channel(`project:${projectId}`);

    channel.on("broadcast", { event: "canvas_op" }, ({ payload }) => {
      handlersRef.current.onCanvasOp(payload as CanvasOpPayload);
    });

    subscribeTable<LocationPin>(channel, "location_pins", projectId, {
      onUpdate: (pin) => handlersRef.current.onPinUpdate(pin),
      onInsert: (pin) => handlersRef.current.onPinInsert?.(pin),
      onDelete: (id) => handlersRef.current.onPinDelete?.(id),
    });

    subscribeTable<TimelineEvent>(channel, "timeline_events", projectId, {
      onUpdate: (event) => handlersRef.current.onEventUpdate(event),
      onInsert: (event) => handlersRef.current.onEventInsert?.(event),
      onDelete: (id) => handlersRef.current.onEventDelete?.(id),
    });

    subscribeTable<Character>(channel, "characters", projectId, {
      onUpdate: (character) => handlersRef.current.onCharacterUpdate?.(character),
      onInsert: (character) => handlersRef.current.onCharacterInsert?.(character),
      onDelete: (id) => handlersRef.current.onCharacterDelete?.(id),
    });

    channel.on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "exports",
        filter: `project_id=eq.${projectId}`,
      },
      ({ new: exp }) => handlersRef.current.onExportUpdate(exp as Export),
    );

    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [projectId]);
}

type BroadcastChannelEntry = {
  ready: Promise<void>;
  send: (op: CanvasOpPayload) => Promise<void>;
};

const broadcastChannels = new Map<string, BroadcastChannelEntry>();

function getBroadcastChannel(projectId: string): BroadcastChannelEntry {
  const existing = broadcastChannels.get(projectId);
  if (existing) return existing;

  const supabase = createClient();
  const channel = supabase.channel(`project:${projectId}`);

  const ready = new Promise<void>((resolve, reject) => {
    channel.subscribe((status, err) => {
      if (status === "SUBSCRIBED") resolve();
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        reject(err ?? new Error(`Realtime channel ${status}`));
      }
    });
  });

  const entry: BroadcastChannelEntry = {
    ready,
    send: async (op) => {
      await ready;
      const result = await channel.send({
        type: "broadcast",
        event: "canvas_op",
        payload: op,
      });
      if (result === "error") {
        throw new Error("Failed to broadcast canvas op");
      }
    },
  };

  broadcastChannels.set(projectId, entry);
  return entry;
}

export async function broadcastCanvasOp(
  projectId: string,
  op: CanvasOpPayload,
) {
  if (!isSupabaseConfigured()) return;

  try {
    await getBroadcastChannel(projectId).send(op);
  } catch {
    broadcastChannels.delete(projectId);
  }
}
