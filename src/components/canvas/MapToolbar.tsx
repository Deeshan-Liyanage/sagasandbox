"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Eraser,
  ImageDown,
  MapPin,
  Move,
  Pencil,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { CanvasTool } from "./canvas-tool";

export type { CanvasTool };
export type MapExportVariant = "clean" | "overlay";

export interface MapToolPaletteProps {
  tool: CanvasTool;
  hasSceneryImage: boolean;
  onToolChange: (tool: CanvasTool) => void;
}

/**
 * Compact icon-only tool palette docked at the top-center of the map.
 * Replaces the prior text-button toolbar to reduce visual noise.
 */
export function MapToolPalette({
  tool,
  hasSceneryImage,
  onToolChange,
}: MapToolPaletteProps) {
  return (
    <div
      role="toolbar"
      aria-label="Map tools"
      className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-lg border border-[#2a2a30] bg-[#1a1a1e]/95 p-1 shadow-lg backdrop-blur"
    >
      <ToolIconButton
        icon={Pencil}
        label="Map · draw / drop pins (B)"
        active={tool === "map"}
        onClick={() => onToolChange("map")}
      />
      <ToolIconButton
        icon={Eraser}
        label="Eraser (E)"
        active={tool === "eraser"}
        onClick={() => onToolChange(tool === "eraser" ? "map" : "eraser")}
      />
      {hasSceneryImage ? (
        <ToolIconButton
          icon={Move}
          label="Adjust scenery (S)"
          active={tool === "scenery"}
          onClick={() => onToolChange(tool === "scenery" ? "map" : "scenery")}
        />
      ) : null}
    </div>
  );
}

interface ToolIconButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  onClick: () => void;
}

function ToolIconButton({
  icon: Icon,
  label,
  active,
  onClick,
}: ToolIconButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-md text-[#9ca3af] transition hover:text-white",
        active
          ? "bg-[#7c3aed] text-white hover:text-white"
          : "hover:bg-[#252528]",
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

export interface MapFloatingActionsProps {
  apiAvailable: boolean;
  pinCount: number;
  locationsOpen: boolean;
  onToggleLocations: () => void;
  onExport: (variant: MapExportVariant) => void;
  onSynthesize: () => void;
  synthesizing: boolean;
  promptPreviewLoading: boolean;
  notes: string;
  onNotesChange: (next: string) => void;
  onPersistNotes: () => void;
  advancedMode: boolean;
  onToggleAdvanced: () => void;
  hasSceneryImage: boolean;
}

/**
 * Floating action group docked at the top-right of the map. Contains the
 * scenery synthesis primary action (with options popover), an export menu,
 * and a locations panel toggle. Mirrors prior toolbar capabilities in a
 * less-crowded layout.
 */
export function MapFloatingActions({
  apiAvailable,
  pinCount,
  locationsOpen,
  onToggleLocations,
  onExport,
  onSynthesize,
  synthesizing,
  promptPreviewLoading,
  notes,
  onNotesChange,
  onPersistNotes,
  advancedMode,
  onToggleAdvanced,
  hasSceneryImage,
}: MapFloatingActionsProps) {
  return (
    <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5">
      {apiAvailable ? (
        <SynthesizeControl
          onSynthesize={onSynthesize}
          synthesizing={synthesizing}
          promptPreviewLoading={promptPreviewLoading}
          notes={notes}
          onNotesChange={onNotesChange}
          onPersistNotes={onPersistNotes}
          advancedMode={advancedMode}
          onToggleAdvanced={onToggleAdvanced}
        />
      ) : null}
      <ExportMenu onExport={onExport} hasSceneryImage={hasSceneryImage} />
      <LocationsToggle
        count={pinCount}
        active={locationsOpen}
        onClick={onToggleLocations}
      />
    </div>
  );
}

interface SynthesizeControlProps {
  onSynthesize: () => void;
  synthesizing: boolean;
  promptPreviewLoading: boolean;
  notes: string;
  onNotesChange: (next: string) => void;
  onPersistNotes: () => void;
  advancedMode: boolean;
  onToggleAdvanced: () => void;
}

function SynthesizeControl({
  onSynthesize,
  synthesizing,
  promptPreviewLoading,
  notes,
  onNotesChange,
  onPersistNotes,
  advancedMode,
  onToggleAdvanced,
}: SynthesizeControlProps) {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const busy = synthesizing || promptPreviewLoading;

  useEffect(() => {
    if (!optionsOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOptionsOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [optionsOpen]);

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-stretch overflow-hidden rounded-md border border-[#7c3aed]/40 bg-[#7c3aed]/10 text-[#a78bfa] shadow-sm">
        <button
          type="button"
          disabled={busy}
          onClick={onSynthesize}
          title="Generate scenery from your sketch and theme"
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition hover:bg-[#7c3aed]/20 hover:text-white",
            busy && "cursor-wait opacity-60",
          )}
        >
          <Sparkles className="h-3.5 w-3.5" />
          {synthesizing
            ? "Generating…"
            : promptPreviewLoading
              ? "Loading…"
              : "Generate"}
        </button>
        <span className="w-px self-stretch bg-[#7c3aed]/30" aria-hidden />
        <button
          type="button"
          aria-label="Generation options"
          aria-expanded={optionsOpen}
          onClick={() => setOptionsOpen((v) => !v)}
          className="inline-flex h-full w-7 items-center justify-center text-[#a78bfa] transition hover:bg-[#7c3aed]/20 hover:text-white"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>

      {optionsOpen ? (
        <div className="absolute right-0 top-full z-20 mt-1 w-72 rounded-lg border border-[#2a2a30] bg-[#141416] p-3 shadow-xl">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[#6b7280]">
            Scenery options
          </p>
          <label className="block">
            <span className="mb-1 block text-[11px] text-[#9ca3af]">
              Extra instructions
            </span>
            <input
              type="text"
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              onBlur={onPersistNotes}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder="e.g. watercolor, no text, top-down…"
              disabled={synthesizing}
              className={cn(
                "w-full rounded-md border border-[#2a2a30] bg-[#0e0e0f] px-2 py-1.5 text-xs text-white placeholder:text-[#6b7280] focus:border-[#7c3aed] focus:outline-none",
                synthesizing && "cursor-not-allowed opacity-60",
              )}
            />
          </label>
          <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-xs text-[#9ca3af]">
            <input
              type="checkbox"
              checked={advancedMode}
              onChange={onToggleAdvanced}
              disabled={synthesizing}
              className="h-3.5 w-3.5 rounded border-[#2a2a30] bg-[#0e0e0f] text-[#7c3aed] focus:ring-[#7c3aed]/40"
            />
            <span>Preview prompt before generating</span>
          </label>
          <p className="mt-2 text-[10px] text-[#5b6270]">
            Notes are saved automatically and reused on the next run.
          </p>
        </div>
      ) : null}
    </div>
  );
}

interface ExportMenuProps {
  onExport: (variant: MapExportVariant) => void;
  hasSceneryImage: boolean;
}

function ExportMenu({ onExport, hasSceneryImage }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const handlePick = useCallback(
    (variant: MapExportVariant) => {
      onExport(variant);
      setOpen(false);
    },
    [onExport],
  );

  return (
    <div ref={containerRef} className="relative">
      <ActionIconButton
        icon={ImageDown}
        label="Export map as PNG"
        active={open}
        onClick={() => setOpen((v) => !v)}
      />
      {open ? (
        <div className="absolute right-0 top-full z-20 mt-1 w-64 overflow-hidden rounded-lg border border-[#2a2a30] bg-[#141416] py-1 shadow-xl">
          <ExportMenuItem
            label="Pins & sketches"
            description="Strokes and pins overlaid on backdrop."
            onClick={() => handlePick("overlay")}
          />
          <ExportMenuItem
            label={hasSceneryImage ? "Scenery only" : "Map only"}
            description={
              hasSceneryImage
                ? "Generated backdrop, no strokes or pins."
                : "Empty map (or backdrop) without strokes or pins."
            }
            onClick={() => handlePick("clean")}
          />
        </div>
      ) : null}
    </div>
  );
}

function ExportMenuItem({
  label,
  description,
  onClick,
}: {
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full px-3 py-2 text-left text-xs text-[#e5e7eb] transition hover:bg-[#1f1f23]"
    >
      <span className="font-medium">{label}</span>
      <span className="mt-0.5 block text-[10px] text-[#6b7280]">
        {description}
      </span>
    </button>
  );
}

interface LocationsToggleProps {
  count: number;
  active: boolean;
  onClick: () => void;
}

function LocationsToggle({ count, active, onClick }: LocationsToggleProps) {
  return (
    <button
      type="button"
      title={`Locations (${count})`}
      aria-label={`Locations (${count})`}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "relative inline-flex h-8 items-center gap-1.5 rounded-md border px-2 text-xs font-medium transition",
        active
          ? "border-[#7c3aed]/50 bg-[#7c3aed]/15 text-[#c4b5fd]"
          : "border-[#2a2a30] bg-[#1a1a1e] text-[#9ca3af] hover:border-[#7c3aed]/40 hover:text-white",
      )}
    >
      <MapPin className="h-3.5 w-3.5" />
      <span className="font-mono text-[11px]">{count}</span>
    </button>
  );
}

interface ActionIconButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  onClick: () => void;
}

function ActionIconButton({
  icon: Icon,
  label,
  active,
  onClick,
}: ActionIconButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active ?? undefined}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md border transition",
        active
          ? "border-[#7c3aed]/50 bg-[#7c3aed]/15 text-[#c4b5fd]"
          : "border-[#2a2a30] bg-[#1a1a1e] text-[#9ca3af] hover:border-[#7c3aed]/40 hover:text-white",
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

export interface MapHelpButtonProps {
  hasSceneryImage: boolean;
}

/**
 * Tiny help affordance docked at the top-left of the map. Sits above the
 * `LocationsPanel` slide-in (which lives along the right edge), so the
 * hint popover is always reachable. The popover opens downward.
 */
export function MapHelpButton({ hasSceneryImage }: MapHelpButtonProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div ref={containerRef} className="absolute left-3 top-3 z-10">
      <button
        type="button"
        aria-label="Map controls help"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-semibold transition",
          open
            ? "border-[#7c3aed]/40 bg-[#7c3aed]/15 text-[#c4b5fd]"
            : "border-[#2a2a30] bg-[#1a1a1e]/80 text-[#9ca3af] hover:text-white",
        )}
      >
        ?
      </button>
      {open ? (
        <div className="absolute left-0 top-full mt-2 w-72 rounded-lg border border-[#2a2a30] bg-[#141416]/95 p-3 text-[11px] leading-relaxed text-[#9ca3af] shadow-xl backdrop-blur">
          <p className="mb-1.5 font-medium text-white">Map controls</p>
          <ul className="space-y-1">
            <li>
              <Kbd>Drag</Kbd> to draw
            </li>
            <li>
              <Kbd>Click</Kbd> empty space to drop a pin
            </li>
            <li>
              <Kbd>Space</Kbd> / <Kbd>Alt</Kbd> / <Kbd>Shift</Kbd> + drag to pan
            </li>
            <li>
              <Kbd>Middle</Kbd> / <Kbd>Right</Kbd> mouse drag to pan
            </li>
            <li>
              <Kbd>Scroll</Kbd> to zoom
            </li>
          </ul>
          {hasSceneryImage ? (
            <p className="mt-2 text-[10px] text-[#5b6270]">
              Sketch strokes are dimmed while scenery is visible.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-[#2a2a30] bg-[#0e0e0f] px-1 py-px font-mono text-[10px] text-[#cbd5e1]">
      {children}
    </kbd>
  );
}
