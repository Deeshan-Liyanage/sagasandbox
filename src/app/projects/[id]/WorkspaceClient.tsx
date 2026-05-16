"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AppShell, type SidebarNav } from "@/components/layout/AppShell";
import { CharacterVault } from "@/components/vault/CharacterVault";
import { PinSidebar } from "@/components/canvas/PinSidebar";
import { ExportTerminal } from "@/components/export/ExportTerminal";
import { TimelineStrip } from "@/components/timeline/TimelineStrip";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import type { GeographyCanvasHandle } from "@/components/canvas/GeographyCanvas";
import { useProjectRealtime } from "@/hooks/useRealtime";
import type { CanvasOpPayload } from "@/hooks/useRealtime";
import { useUIStore } from "@/store/ui-store";
import { themeAccent } from "@/lib/constants";
import {
  isProjectApiAvailable,
  PROJECT_API_UNAVAILABLE_MESSAGE,
  readApiError,
} from "@/lib/project-api";
import { createClient } from "@/lib/supabase-client";
import { isSupabaseConfigured } from "@/lib/supabase-env";
import type {
  Character,
  LocationPin,
  Project,
  TimelineEvent,
} from "@/types/app";

const GeographyCanvas = dynamic(
  () =>
    import("@/components/canvas/GeographyCanvas").then(
      (m) => m.GeographyCanvas,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <div className="h-48 w-full max-w-md animate-pulse rounded-lg bg-[#1a1a1e]" />
      </div>
    ),
  },
);

export interface WorkspaceClientProps {
  project: Project;
  initialPins: LocationPin[];
  initialEvents: TimelineEvent[];
  initialCharacters: Character[];
  userId?: string;
  /** When false, mutation UIs stay disabled (e.g. mock demo workspace). */
  apiAvailable?: boolean;
}

const CANVAS_PERSIST_MS = 800;

export function WorkspaceClient({
  project,
  initialPins,
  initialEvents,
  initialCharacters,
  userId: initialUserId,
  apiAvailable: apiAvailableProp,
}: WorkspaceClientProps) {
  const [pins, setPins] = useState(initialPins);
  const [events, setEvents] = useState(initialEvents);
  const [characters, setCharacters] = useState(initialCharacters);
  const [activeNav, setActiveNav] = useState<SidebarNav>("canvas");
  const [userId, setUserId] = useState(initialUserId ?? "local");
  const [canvasPersistError, setCanvasPersistError] = useState<string | null>(
    null,
  );

  const canvasRef = useRef<GeographyCanvasHandle>(null);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const apiAvailable =
    apiAvailableProp ?? isProjectApiAvailable(project.id);

  const {
    selectedPin,
    setSelectedPin,
    sidebarMode,
    setSidebarMode,
    setActiveEvent,
  } = useUIStore();

  const accent = themeAccent(project.theme);

  useEffect(() => {
    if (initialUserId) return;
    if (!isSupabaseConfigured()) return;

    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user?.id) setUserId(data.user.id);
    });
  }, [initialUserId]);

  useEffect(() => {
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, []);

  const handlePinUpdate = useCallback(
    (pin: LocationPin) => {
      setPins((prev) => prev.map((p) => (p.id === pin.id ? pin : p)));
      if (useUIStore.getState().selectedPin?.id === pin.id) {
        setSelectedPin(pin);
      }
    },
    [setSelectedPin],
  );

  const handleEventUpdate = useCallback(
    (event: TimelineEvent) => {
      setEvents((prev) => prev.map((e) => (e.id === event.id ? event : e)));
      if (useUIStore.getState().activeEvent?.id === event.id) {
        setActiveEvent(event);
      }
    },
    [setActiveEvent],
  );

  const handleCharacterUpdate = useCallback((character: Character) => {
    setCharacters((prev) =>
      prev.map((c) => (c.id === character.id ? character : c)),
    );
  }, []);

  const handleCanvasOp = useCallback((op: CanvasOpPayload) => {
    canvasRef.current?.applyCanvasOp(op);
  }, []);

  const handleCanvasChange = useCallback(
    (konvaJson: object) => {
      if (!apiAvailable) return;

      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
      persistTimerRef.current = setTimeout(() => {
        void (async () => {
          try {
            const res = await fetch(`/api/projects/${project.id}/canvas`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ canvas_state: konvaJson }),
            });
            if (!res.ok) {
              throw new Error(await readApiError(res, "Failed to save canvas"));
            }
            setCanvasPersistError(null);
          } catch (err) {
            setCanvasPersistError(
              err instanceof Error ? err.message : "Failed to save canvas",
            );
          }
        })();
      }, CANVAS_PERSIST_MS);
    },
    [apiAvailable, project.id],
  );

  const realtimeHandlers = useMemo(
    () => ({
      onCanvasOp: handleCanvasOp,
      onPinUpdate: handlePinUpdate,
      onEventUpdate: handleEventUpdate,
      onExportUpdate: () => {},
      onCharacterUpdate: handleCharacterUpdate,
    }),
    [handleCanvasOp, handlePinUpdate, handleEventUpdate, handleCharacterUpdate],
  );

  useProjectRealtime(project.id, realtimeHandlers);

  const sidebarContent = useMemo(() => {
    if (sidebarMode === "vault") {
      return (
        <CharacterVault
          projectId={project.id}
          characters={characters}
          apiAvailable={apiAvailable}
          onCharactersChange={setCharacters}
        />
      );
    }
    if (sidebarMode === "export") {
      return (
        <ExportTerminal
          projectId={project.id}
          events={events}
          apiAvailable={apiAvailable}
        />
      );
    }
    return (
      <p className="text-xs text-[#9ca3af]">
        Use the nav to open Character Vault or Export — or click a pin on the
        canvas.
      </p>
    );
  }, [sidebarMode, project.id, characters, events, apiAvailable]);

  return (
    <div
      className="h-screen"
      style={{ ["--accent" as string]: accent }}
    >
      <AppShell
        projectName={project.name}
        theme={project.theme}
        activeNav={activeNav}
        onNavChange={(nav) => {
          setActiveNav(nav);
          if (nav === "vault") setSidebarMode("vault");
          else if (nav === "export") setSidebarMode("export");
          else setSidebarMode(null);
        }}
        onExportClick={() => setSidebarMode("export")}
        sidebarContent={sidebarContent}
        timelineContent={
          <TimelineStrip
            projectId={project.id}
            events={events}
            pins={pins}
            characters={characters}
            apiAvailable={apiAvailable}
            onEventsChange={setEvents}
          />
        }
      >
        <ErrorBoundary>
          {!apiAvailable ? (
            <p className="border-b border-[#2a2a2e] bg-[#1a1a1e] px-4 py-2 text-center text-xs text-[#9ca3af]">
              {PROJECT_API_UNAVAILABLE_MESSAGE}
            </p>
          ) : null}
          {canvasPersistError ? (
            <p className="border-b border-[#ef4444]/30 bg-[#1a1a1e] px-4 py-2 text-center text-xs text-[#ef4444]">
              {canvasPersistError}
            </p>
          ) : null}
          <GeographyCanvas
            ref={canvasRef}
            projectId={project.id}
            pins={pins}
            userId={userId}
            apiAvailable={apiAvailable}
            onPinsChange={setPins}
            onPinSelect={(pin) => {
              setSelectedPin(pin);
              setSidebarMode("pin");
            }}
            onCanvasChange={handleCanvasChange}
          />
        </ErrorBoundary>
      </AppShell>

      {sidebarMode === "pin" && selectedPin ? (
        <PinSidebar
          key={selectedPin.id}
          pin={selectedPin}
          projectId={project.id}
          apiAvailable={apiAvailable}
          onClose={() => {
            setSelectedPin(null);
            setSidebarMode(null);
          }}
          onPinUpdated={handlePinUpdate}
          onPinDeleted={(pinId) => {
            setPins((prev) => prev.filter((p) => p.id !== pinId));
            setSelectedPin(null);
          }}
        />
      ) : null}
    </div>
  );
}
