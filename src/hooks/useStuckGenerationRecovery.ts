"use client";

import { useEffect, useRef } from "react";
import type { Character, LocationPin, TimelineEvent } from "@/types/app";

/**
 * Recovery loop for fal.ai generations that get stuck in `gen_status =
 * "generating"`. This happens when the production webhook path
 * (`POST /api/webhooks/fal` → `handle-fal-webhook`) misses a delivery —
 * e.g. cold-start crash, 502 during a deploy, or a transient network
 * blip on fal.ai's side. Without recovery, the affected pin / event /
 * character sits in the loading skeleton forever.
 *
 * The hook walks the realtime row state on a fixed interval and, for
 * each row that has been "generating" for longer than the stuck
 * threshold, POSTs the row's `fal_request_id` to `/api/fal/poll`. That
 * endpoint asks fal.ai for the result directly and, if completed,
 * writes `gen_status = "done"` to the DB. The Supabase Realtime
 * subscription in `useProjectRealtime` then re-renders the row.
 */

const STUCK_THRESHOLD_MS = 60_000;
const POLL_INTERVAL_MS = 15_000;
const POLL_COOLDOWN_MS = 30_000;

interface TrackedRow {
  request_id: string;
  /** First time *this client* observed the row in `generating` state. */
  firstSeenAt: number;
  /** Last time the recovery loop POSTed to /api/fal/poll. */
  lastPolledAt: number;
}

interface UseStuckGenerationRecoveryArgs {
  pins: LocationPin[];
  events: TimelineEvent[];
  characters: Character[];
  apiAvailable: boolean;
}

export function useStuckGenerationRecovery({
  pins,
  events,
  characters,
  apiAvailable,
}: UseStuckGenerationRecoveryArgs) {
  const trackedRef = useRef<Map<string, TrackedRow>>(new Map());
  const pinsRef = useRef(pins);
  const eventsRef = useRef(events);
  const charactersRef = useRef(characters);

  useEffect(() => {
    pinsRef.current = pins;
  }, [pins]);
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);
  useEffect(() => {
    charactersRef.current = characters;
  }, [characters]);

  useEffect(() => {
    if (!apiAvailable) return;

    const tick = () => {
      const now = Date.now();
      const tracked = trackedRef.current;
      const seenIds = new Set<string>();

      const inspect = (
        id: string,
        gen_status: string | null,
        fal_request_id: string | null,
      ) => {
        if (gen_status !== "generating" || !fal_request_id) return;
        seenIds.add(id);
        if (!tracked.has(id)) {
          tracked.set(id, {
            request_id: fal_request_id,
            firstSeenAt: now,
            lastPolledAt: 0,
          });
        }
      };

      for (const pin of pinsRef.current) {
        inspect(pin.id, pin.gen_status, pin.fal_request_id);
      }
      for (const event of eventsRef.current) {
        inspect(event.id, event.gen_status, event.fal_request_id);
      }
      for (const character of charactersRef.current) {
        inspect(character.id, character.gen_status, character.fal_request_id);
      }

      // Forget rows that finished or were deleted so re-entry into
      // "generating" later starts a fresh stuck-timer.
      for (const id of [...tracked.keys()]) {
        if (!seenIds.has(id)) tracked.delete(id);
      }

      for (const [id, row] of tracked) {
        if (now - row.firstSeenAt < STUCK_THRESHOLD_MS) continue;
        if (now - row.lastPolledAt < POLL_COOLDOWN_MS) continue;
        row.lastPolledAt = now;
        void fetch("/api/fal/poll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ request_id: row.request_id }),
        }).catch((err) => {
          // Recovery is best-effort; the next tick will retry.
          console.warn(`[stuck-recovery] poll failed for row=${id}`, err);
        });
      }
    };

    tick();
    const interval = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      clearInterval(interval);
    };
  }, [apiAvailable]);
}
