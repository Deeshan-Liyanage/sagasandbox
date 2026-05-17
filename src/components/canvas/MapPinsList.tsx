"use client";

import { MapPinned } from "lucide-react";
import type { LocationPin } from "@/types/app";
import { cn } from "@/lib/cn";
import { GEN_STATUS_COLORS } from "@/lib/constants";

export interface MapPinsListProps {
  pins: LocationPin[];
  activePinId?: string | null;
  highlightedPinId?: string | null;
  onPinSelect: (pin: LocationPin) => void;
  onFocusPin: (pin: LocationPin) => void;
}

function pinAccent(status: LocationPin["gen_status"]) {
  return GEN_STATUS_COLORS[status] ?? "#10b981";
}

export function MapPinsList({
  pins,
  activePinId,
  highlightedPinId,
  onPinSelect,
  onFocusPin,
}: MapPinsListProps) {
  if (pins.length === 0) {
    return (
      <aside
        aria-label="Map locations"
        className="pointer-events-auto absolute bottom-24 left-0 top-14 z-[3] flex w-[min(240px,90vw)] flex-col border border-l-0 border-t-0 border-[#2a2a2e] bg-[#1a1a1e]/96 shadow-lg backdrop-blur-sm"
      >
        <header className="flex items-center gap-2 border-b border-[#2a2a2e] px-3 py-2.5">
          <MapPinned className="h-4 w-4 shrink-0 text-[#a78bfa]" />
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
            Locations
          </h2>
        </header>
        <p className="px-3 py-4 text-xs text-[#6b7280]">
          No pins yet. Click empty map space to drop a location.
        </p>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Map locations"
      className="pointer-events-auto absolute bottom-24 left-0 top-14 z-[3] flex w-[min(260px,90vw)] flex-col border border-l-0 border-t-0 border-[#2a2a2e] bg-[#1a1a1e]/96 shadow-lg backdrop-blur-sm"
    >
      <header className="flex items-center justify-between border-b border-[#2a2a2e] px-3 py-2">
        <div className="flex items-center gap-2">
          <MapPinned className="h-4 w-4 shrink-0 text-[#a78bfa]" />
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
            Locations
          </h2>
          <span className="rounded bg-[#0f0f12] px-1.5 py-0.5 font-mono text-[10px] text-[#6b7280]">
            {pins.length}
          </span>
        </div>
      </header>

      <ul className="min-h-0 flex-1 list-none overflow-y-auto p-2 pb-16">
        {pins.map((pin) => {
          const isActive =
            pin.id === activePinId || pin.id === highlightedPinId;
          const accent = pinAccent(pin.gen_status);

          return (
            <li key={pin.id} className="mb-1">
              <div
                className={cn(
                  "flex rounded-md overflow-hidden transition-colors",
                  isActive ? "bg-[#7c3aed]/25 ring-1 ring-[#7c3aed]/50" : "",
                )}
              >
                <button
                  type="button"
                  onClick={() => onPinSelect(pin)}
                  className={cn(
                    "flex min-w-0 flex-1 items-start gap-2 px-2 py-2 text-left",
                    !isActive ? "hover:bg-[#2a2a2e]" : "",
                  )}
                >
                  <span
                    className="mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: accent }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-[13px] font-medium leading-tight text-[#e5e7eb]">
                      {pin.label || "Untitled"}
                    </span>
                    {(pin.description?.trim().length ?? 0) > 0 ? (
                      <span className="mt-0.5 line-clamp-2 block text-[11px] text-[#6b7280]">
                        {pin.description}
                      </span>
                    ) : (
                      <span className="mt-0.5 block font-mono text-[10px] text-[#5b6270]">
                        {Math.round(pin.canvas_x)},{" "}
                        {Math.round(pin.canvas_y)}
                      </span>
                    )}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onFocusPin(pin)}
                  className={cn(
                    "shrink-0 self-center rounded px-2 py-2 text-[10px] uppercase tracking-wide",
                    "text-[#a78bfa] hover:bg-[#7c3aed]/20 hover:text-[#ddd6fe]",
                  )}
                  title="Center map on this pin"
                >
                  Focus
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
