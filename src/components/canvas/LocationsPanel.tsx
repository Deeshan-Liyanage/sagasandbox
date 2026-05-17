"use client";

import { memo, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  MapPin,
  Trash2,
  X,
} from "lucide-react";
import type { LocationPin } from "@/types/app";
import { asGenStatus } from "@/types/app";
import { GenStatusImage } from "@/components/shared/GenStatusImage";
import { GEN_STATUS_COLORS } from "@/lib/constants";
import { cn } from "@/lib/cn";
import {
  PROJECT_API_UNAVAILABLE_MESSAGE,
  readApiError,
} from "@/lib/project-api";

export interface LocationsPanelProps {
  open: boolean;
  pins: LocationPin[];
  projectId: string;
  apiAvailable: boolean;
  selectedPin: LocationPin | null;
  highlightedPinId?: string | null;
  onClose: () => void;
  onPinSelect: (pin: LocationPin) => void;
  onFocusPin: (pin: LocationPin) => void;
  onPinUpdated: (pin: LocationPin) => void;
  onPinDeleted: (pinId: string) => void;
  onCloseSelectedPin: () => void;
}

const PANEL_CLASSES =
  "absolute inset-y-0 right-0 z-[6] flex w-[300px] max-w-[40vw] flex-col border-l border-[#2a2a30] bg-[#141416] shadow-[-12px_0_24px_rgba(0,0,0,0.25)]";

function pinAccent(status: LocationPin["gen_status"]) {
  return GEN_STATUS_COLORS[status] ?? "#10b981";
}

export function LocationsPanel(props: LocationsPanelProps) {
  const {
    open,
    pins,
    projectId,
    apiAvailable,
    selectedPin,
    highlightedPinId,
    onClose,
    onPinSelect,
    onFocusPin,
    onPinUpdated,
    onPinDeleted,
    onCloseSelectedPin,
  } = props;

  if (!open) return null;

  return (
    <aside
      aria-label={selectedPin ? "Location details" : "Locations"}
      className={PANEL_CLASSES}
    >
      {selectedPin ? (
        <PinDetailView
          key={selectedPin.id}
          pin={selectedPin}
          projectId={projectId}
          apiAvailable={apiAvailable}
          onBack={onCloseSelectedPin}
          onClose={onClose}
          onPinUpdated={onPinUpdated}
          onPinDeleted={onPinDeleted}
        />
      ) : (
        <PinListView
          pins={pins}
          highlightedPinId={highlightedPinId ?? null}
          onClose={onClose}
          onPinSelect={onPinSelect}
          onFocusPin={onFocusPin}
        />
      )}
    </aside>
  );
}

interface PinListViewProps {
  pins: LocationPin[];
  highlightedPinId: string | null;
  onClose: () => void;
  onPinSelect: (pin: LocationPin) => void;
  onFocusPin: (pin: LocationPin) => void;
}

function PinListView({
  pins,
  highlightedPinId,
  onClose,
  onPinSelect,
  onFocusPin,
}: PinListViewProps) {
  return (
    <>
      <PanelHeader
        icon={<MapPin className="h-3.5 w-3.5 text-[#a78bfa]" />}
        title="Locations"
        count={pins.length}
        onClose={onClose}
      />
      {pins.length === 0 ? (
        <div className="flex min-h-0 flex-1 flex-col items-start gap-2 px-4 py-5">
          <p className="text-xs leading-relaxed text-[#6b7280]">
            No pins yet. Click an empty spot on the map to drop a location.
          </p>
        </div>
      ) : (
        <ul className="min-h-0 flex-1 list-none overflow-y-auto overflow-x-hidden p-2">
          {pins.map((pin) => (
            <PinListItem
              key={pin.id}
              pin={pin}
              isActive={pin.id === highlightedPinId}
              onSelect={onPinSelect}
              onFocus={onFocusPin}
            />
          ))}
        </ul>
      )}
    </>
  );
}

interface PinListItemProps {
  pin: LocationPin;
  isActive: boolean;
  onSelect: (pin: LocationPin) => void;
  onFocus: (pin: LocationPin) => void;
}

const PinListItem = memo(function PinListItem({
  pin,
  isActive,
  onSelect,
  onFocus,
}: PinListItemProps) {
  const accent = pinAccent(pin.gen_status);
  const description = pin.description?.trim();

  return (
    <li className="mb-1">
      <div
        className={cn(
          "group flex items-stretch overflow-hidden rounded-md transition-colors",
          isActive
            ? "bg-[#7c3aed]/15 ring-1 ring-[#7c3aed]/40"
            : "hover:bg-[#1a1a1e]",
        )}
      >
        <button
          type="button"
          onClick={() => onSelect(pin)}
          className="flex min-w-0 flex-1 items-start gap-2.5 px-2.5 py-2 text-left"
        >
          <span
            className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: accent }}
            aria-hidden
          />
          <span className="min-w-0 flex-1">
            <span className="line-clamp-1 text-[13px] font-medium text-[#e5e7eb]">
              {pin.label || "Untitled"}
            </span>
            {description ? (
              <span className="mt-0.5 line-clamp-1 block text-[11px] text-[#6b7280]">
                {description}
              </span>
            ) : null}
          </span>
        </button>
        <button
          type="button"
          onClick={() => onFocus(pin)}
          title="Center map on this pin"
          aria-label={`Center map on ${pin.label || "pin"}`}
          className={cn(
            "flex shrink-0 items-center justify-center px-2 text-[#6b7280] opacity-0 transition group-hover:opacity-100",
            "hover:text-[#a78bfa]",
            isActive && "opacity-100 text-[#a78bfa]",
          )}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
});

interface PinDetailViewProps {
  pin: LocationPin;
  projectId: string;
  apiAvailable: boolean;
  onBack: () => void;
  onClose: () => void;
  onPinUpdated: (pin: LocationPin) => void;
  onPinDeleted: (pinId: string) => void;
}

function PinDetailView({
  pin,
  projectId,
  apiAvailable,
  onBack,
  onClose,
  onPinUpdated,
  onPinDeleted,
}: PinDetailViewProps) {
  // Note: parent passes `key={pin.id}` to remount this view per selected pin,
  // so initial state always reflects the current pin without needing a sync effect.
  const [label, setLabel] = useState(pin.label ?? "");
  const [description, setDescription] = useState(pin.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patchPin(body: { label?: string; description?: string }) {
    if (!apiAvailable) {
      setError(PROJECT_API_UNAVAILABLE_MESSAGE);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/pins/${pin.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        throw new Error(await readApiError(res, "Update failed"));
      }
      const { pin: updated } = (await res.json()) as { pin: LocationPin };
      onPinUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleBlur() {
    if (label === (pin.label ?? "") && description === (pin.description ?? "")) {
      return;
    }
    await patchPin({ label, description });
  }

  async function handleRetry() {
    await patchPin({ description: description || pin.description || "" });
  }

  async function handleDelete() {
    if (!apiAvailable) {
      setError(PROJECT_API_UNAVAILABLE_MESSAGE);
      return;
    }
    if (!confirm("Delete this location pin?")) return;
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/pins/${pin.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        throw new Error(await readApiError(res, "Delete failed"));
      }
      onPinDeleted(pin.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <>
      <header className="flex shrink-0 items-center gap-1 border-b border-[#2a2a30] px-2 py-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to locations list"
          className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-[#9ca3af] hover:bg-[#1a1a1e] hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Locations
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#9ca3af] hover:bg-[#1a1a1e] hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3">
        <GenStatusImage
          status={asGenStatus(pin.gen_status)}
          imageUrl={pin.generated_image_url}
          alt={pin.label}
          onRetry={
            asGenStatus(pin.gen_status) === "error" ? handleRetry : undefined
          }
        />

        <label className="block">
          <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[#6b7280]">
            Name
          </span>
          <input
            type="text"
            value={label}
            disabled={saving || !apiAvailable}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={handleBlur}
            placeholder="Untitled"
            className="w-full rounded-md border border-[#2a2a30] bg-[#0e0e0f] px-2.5 py-1.5 text-sm text-white outline-none focus:border-[#7c3aed]"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[#6b7280]">
            Description
          </span>
          <textarea
            value={description}
            disabled={saving || !apiAvailable}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleBlur}
            rows={4}
            placeholder="Describe this location…"
            className="w-full resize-none rounded-md border border-[#2a2a30] bg-[#0e0e0f] px-2.5 py-1.5 text-sm text-white outline-none focus:border-[#7c3aed]"
          />
        </label>

        {error ? <p className="text-xs text-[#ef4444]">{error}</p> : null}
      </div>

      <div className="shrink-0 border-t border-[#2a2a30] p-3">
        <button
          type="button"
          onClick={handleDelete}
          disabled={!apiAvailable || saving}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-[#ef4444]/40 px-3 py-1.5 text-xs font-medium text-[#ef4444] transition hover:bg-[#ef4444]/10 disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete pin
        </button>
      </div>
    </>
  );
}

interface PanelHeaderProps {
  icon: React.ReactNode;
  title: string;
  count?: number;
  onClose: () => void;
}

function PanelHeader({ icon, title, count, onClose }: PanelHeaderProps) {
  return (
    <header className="flex shrink-0 items-center gap-2 border-b border-[#2a2a30] px-3 py-2.5">
      {icon}
      <h2 className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
        {title}
      </h2>
      {typeof count === "number" ? (
        <span className="rounded bg-[#0f0f12] px-1.5 py-0.5 font-mono text-[10px] text-[#6b7280]">
          {count}
        </span>
      ) : null}
      <div className="flex-1" />
      <button
        type="button"
        onClick={onClose}
        aria-label="Close panel"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#9ca3af] hover:bg-[#1a1a1e] hover:text-white"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </header>
  );
}
