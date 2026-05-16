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
  onEventUpdate: (event: TimelineEvent) => void;
  onExportUpdate: (exp: Export) => void;
  onCharacterUpdate?: (character: Character) => void;
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

    channel
      .on("broadcast", { event: "canvas_op" }, ({ payload }) => {
        handlersRef.current.onCanvasOp(payload as CanvasOpPayload);
      })
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "location_pins",
          filter: `project_id=eq.${projectId}`,
        },
        ({ new: pin }) => handlersRef.current.onPinUpdate(pin as LocationPin),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "timeline_events",
          filter: `project_id=eq.${projectId}`,
        },
        ({ new: event }) =>
          handlersRef.current.onEventUpdate(event as TimelineEvent),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "exports",
          filter: `project_id=eq.${projectId}`,
        },
        ({ new: exp }) => handlersRef.current.onExportUpdate(exp as Export),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "characters",
          filter: `project_id=eq.${projectId}`,
        },
        ({ new: character }) =>
          handlersRef.current.onCharacterUpdate?.(character as Character),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [projectId]);
}

export async function broadcastCanvasOp(
  projectId: string,
  op: CanvasOpPayload,
) {
  if (!isSupabaseConfigured()) return;

  const supabase = createClient();
  await supabase.channel(`project:${projectId}`).send({
    type: "broadcast",
    event: "canvas_op",
    payload: op,
  });
}
