"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { AppShell, type SidebarNav } from "@/components/layout/AppShell";
import { CharacterVault } from "@/components/vault/CharacterVault";
import { PinSidebar } from "@/components/canvas/PinSidebar";
import { ExportTerminal } from "@/components/export/ExportTerminal";
import { TimelineStrip } from "@/components/timeline/TimelineStrip";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { useProjectRealtime } from "@/hooks/useRealtime";
import { useUIStore } from "@/store/ui-store";
import { themeAccent } from "@/lib/constants";
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
}

export function WorkspaceClient({
  project,
  initialPins,
  initialEvents,
  initialCharacters,
}: WorkspaceClientProps) {
  const [pins, setPins] = useState(initialPins);
  const [events, setEvents] = useState(initialEvents);
  const [characters, setCharacters] = useState(initialCharacters);
  const [activeNav, setActiveNav] = useState<SidebarNav>("canvas");

  const {
    selectedPin,
    setSelectedPin,
    sidebarMode,
    setSidebarMode,
    setActiveEvent,
  } = useUIStore();

  const accent = themeAccent(project.theme);

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
      setActiveEvent(event);
    },
    [setActiveEvent],
  );

  const handleCharacterUpdate = useCallback((character: Character) => {
    setCharacters((prev) =>
      prev.map((c) => (c.id === character.id ? character : c)),
    );
  }, []);

  const realtimeHandlers = useMemo(
    () => ({
      onCanvasOp: () => {},
      onPinUpdate: handlePinUpdate,
      onEventUpdate: handleEventUpdate,
      onExportUpdate: () => {},
      onCharacterUpdate: handleCharacterUpdate,
    }),
    [handlePinUpdate, handleEventUpdate, handleCharacterUpdate],
  );

  useProjectRealtime(project.id, realtimeHandlers);

  const sidebarContent = useMemo(() => {
    if (sidebarMode === "vault") {
      return (
        <CharacterVault
          projectId={project.id}
          characters={characters}
          onCharactersChange={setCharacters}
        />
      );
    }
    if (sidebarMode === "export") {
      return (
        <ExportTerminal projectId={project.id} events={events} />
      );
    }
    return (
      <p className="text-xs text-[#9ca3af]">
        Use the nav to open Character Vault or Export — or click a pin on the
        canvas.
      </p>
    );
  }, [sidebarMode, project.id, characters, events]);

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
            onEventsChange={setEvents}
          />
        }
      >
        <ErrorBoundary>
          <GeographyCanvas
            projectId={project.id}
            initialPins={initialPins}
            pins={pins}
            onPinsChange={setPins}
            onPinSelect={(pin) => {
              setSelectedPin(pin);
              setSidebarMode("pin");
            }}
            onCanvasChange={() => {
              // TODO: debounced PATCH /api/projects/[id]/canvas
            }}
          />
        </ErrorBoundary>
      </AppShell>

      {sidebarMode === "pin" && selectedPin ? (
        <PinSidebar
          key={selectedPin.id}
          pin={selectedPin}
          projectId={project.id}
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
