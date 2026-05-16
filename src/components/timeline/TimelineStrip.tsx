"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, Loader2, Plus } from "lucide-react";
import type { LocationPin, TimelineEvent } from "@/types/app";
import type { Character } from "@/types/app";
import { asGenStatus } from "@/types/app";
import { GenStatusImage } from "@/components/shared/GenStatusImage";
import { RemoteImage } from "@/components/shared/RemoteImage";
interface TimelineStripProps {
  projectId: string;
  events: TimelineEvent[];
  pins: LocationPin[];
  characters: Character[];
  onEventsChange: React.Dispatch<React.SetStateAction<TimelineEvent[]>>;
}

export function TimelineStrip({
  projectId,
  events,
  pins,
  characters,
  onEventsChange,
}: TimelineStripProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    pin_id: "",
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const sequence_order =
      events.length > 0
        ? Math.max(...events.map((ev) => ev.sequence_order)) + 1
        : 0;
    const optimistic: TimelineEvent = {
      id: `temp-${Date.now()}`,
      project_id: projectId,
      pin_id: form.pin_id || null,
      title: form.title,
      description: form.description,
      sequence_order,
      in_world_time: null,
      generated_image_url: null,
      audio_url: null,
      fal_request_id: null,
      gen_status: "pending",
      created_at: new Date().toISOString(),
    };
    onEventsChange((prev) => [...prev, optimistic]);
    setShowAdd(false);
    try {
      const res = await fetch(`/api/projects/${projectId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          sequence_order,
          pin_id: form.pin_id || undefined,
        }),
      });
      if (!res.ok) throw new Error("Create failed");
      const { event } = (await res.json()) as { event: TimelineEvent };
      onEventsChange((prev) =>
        [...prev.filter((ev) => ev.id !== optimistic.id), event].sort(
          (a, b) => a.sequence_order - b.sequence_order,
        ),
      );
      setForm({ title: "", description: "", pin_id: "" });
    } catch {
      onEventsChange((prev) => prev.filter((ev) => ev.id !== optimistic.id));
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = events.findIndex((ev) => ev.id === active.id);
    const newIndex = events.findIndex((ev) => ev.id === over.id);
    const reordered = arrayMove(events, oldIndex, newIndex).map((ev, i) => ({
      ...ev,
      sequence_order: i,
    }));
    onEventsChange(reordered);
    await Promise.all(
      reordered.map((ev) =>
        fetch(`/api/projects/${projectId}/events/${ev.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sequence_order: ev.sequence_order }),
        }),
      ),
    );
  }

  function pinLabel(pinId: string | null) {
    if (!pinId) return null;
    return pins.find((p) => p.id === pinId)?.label ?? "Unknown";
  }

  function matchedCharacters(description: string | null) {
    if (!description) return [];
    const lower = description.toLowerCase();
    return characters.filter((c) => lower.includes(c.name.toLowerCase()));
  }

  if (events.length === 0 && !showAdd) {
    return (
      <div className="flex h-full items-center px-4">
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="text-sm text-[#9ca3af] hover:text-white"
        >
          Add your first event →
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={events.map((e) => e.id)}
          strategy={horizontalListSortingStrategy}
        >
          <div className="flex min-h-0 flex-1 items-stretch gap-3 overflow-x-auto px-4 py-3">
            {events.map((ev) => (
              <SortableEventCard
                key={ev.id}
                event={ev}
                pinLabel={pinLabel(ev.pin_id)}
                expanded={expandedId === ev.id}
                onToggle={() =>
                  setExpandedId(expandedId === ev.id ? null : ev.id)
                }
                matched={matchedCharacters(ev.description)}
              />
            ))}
            <button
              type="button"
              onClick={() => setShowAdd((v) => !v)}
              className="flex h-[88px] w-10 shrink-0 items-center justify-center rounded-lg border border-dashed border-[#2a2a2e] text-[#9ca3af] hover:border-[#7c3aed] hover:text-white"
              aria-label="Add event"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </SortableContext>
      </DndContext>

      {showAdd ? (
        <form
          onSubmit={handleAdd}
          className="flex shrink-0 flex-wrap items-end gap-2 border-t border-[#2a2a2e] px-4 py-2"
        >
          <input
            required
            placeholder="Event title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="min-w-[120px] flex-1 rounded border border-[#2a2a2e] bg-[#0e0e0f] px-2 py-1 text-xs text-white"
          />
          <input
            placeholder="Description"
            value={form.description}
            onChange={(e) =>
              setForm({ ...form, description: e.target.value })
            }
            className="min-w-[160px] flex-[2] rounded border border-[#2a2a2e] bg-[#0e0e0f] px-2 py-1 text-xs text-white"
          />
          <select
            value={form.pin_id}
            onChange={(e) => setForm({ ...form, pin_id: e.target.value })}
            className="rounded border border-[#2a2a2e] bg-[#0e0e0f] px-2 py-1 text-xs text-white"
          >
            <option value="">No pin</option>
            {pins.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded bg-[#7c3aed] px-3 py-1 text-xs font-medium text-white"
          >
            Add
          </button>
        </form>
      ) : null}
    </div>
  );
}

function SortableEventCard({
  event,
  pinLabel,
  expanded,
  onToggle,
  matched,
}: {
  event: TimelineEvent;
  pinLabel: string | null;
  expanded: boolean;
  onToggle: () => void;
  matched: Character[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: event.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative shrink-0">
      <button
        type="button"
        {...attributes}
        {...listeners}
        onClick={onToggle}
        className="flex h-[88px] w-40 flex-col overflow-hidden rounded-lg border border-[#2a2a2e] bg-[#1a1a1e] text-left"
      >
        <div className="relative h-10 shrink-0 overflow-hidden bg-[#252528]">
          {event.gen_status === "done" && event.generated_image_url ? (
            <RemoteImage
              src={event.generated_image_url}
              alt=""
              width={160}
              height={40}
              className="h-full w-full object-cover"
            />
          ) : event.gen_status === "generating" ? (
            <Loader2 className="absolute inset-0 m-auto h-4 w-4 animate-spin text-[#7c3aed]" />
          ) : event.gen_status === "done" ? (
            <Check className="absolute right-1 top-1 h-3 w-3 text-[#10b981]" />
          ) : null}
        </div>
        <div className="flex flex-1 flex-col justify-center px-2 py-1">
          <p className="truncate text-xs font-medium text-white">
            {event.title}
          </p>
          {pinLabel ? (
            <span className="truncate text-[10px] text-[#7c3aed]">
              📍 {pinLabel}
            </span>
          ) : null}
        </div>
      </button>

      {expanded ? (
        <div className="absolute bottom-full left-0 z-20 mb-2 w-64 rounded-lg border border-[#2a2a2e] bg-[#1a1a1e] p-3 shadow-xl">
          <GenStatusImage
            status={asGenStatus(event.gen_status)}
            imageUrl={event.generated_image_url}
            alt={event.title}
            className="mb-2"
          />
          <p className="text-xs text-[#e5e7eb]">{event.description}</p>
          {matched.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {matched.map((c) => (
                <span
                  key={c.id}
                  className="rounded-full bg-[#2a2a2e] px-2 py-0.5 text-[10px]"
                >
                  {c.name}
                </span>
              ))}
            </div>
          ) : null}
          {event.audio_url ? (
            <audio controls src={event.audio_url} className="mt-2 w-full" />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
