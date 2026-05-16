import { create } from "zustand";
import type { LocationPin, TimelineEvent } from "@/types/app";

export type SidebarMode = "vault" | "pin" | "export" | null;

interface UIState {
  selectedPin: LocationPin | null;
  activeEvent: TimelineEvent | null;
  highlightedPinId: string | null;
  sidebarMode: SidebarMode;
  setSelectedPin: (pin: LocationPin | null) => void;
  setActiveEvent: (event: TimelineEvent | null) => void;
  setHighlightedPinId: (pinId: string | null) => void;
  selectEventWithPin: (
    event: TimelineEvent | null,
    pin: LocationPin | null,
  ) => void;
  setSidebarMode: (mode: SidebarMode) => void;
}

export const useUIStore = create<UIState>((set) => ({
  selectedPin: null,
  activeEvent: null,
  highlightedPinId: null,
  sidebarMode: null,
  setSelectedPin: (pin) =>
    set({
      selectedPin: pin,
      highlightedPinId: pin?.id ?? null,
      sidebarMode: pin ? "pin" : null,
    }),
  setActiveEvent: (event) =>
    set({
      activeEvent: event,
      highlightedPinId: event?.pin_id ?? null,
    }),
  setHighlightedPinId: (pinId) => set({ highlightedPinId: pinId }),
  selectEventWithPin: (event, pin) =>
    set({
      activeEvent: event,
      highlightedPinId: event?.pin_id ?? pin?.id ?? null,
      selectedPin: pin,
      sidebarMode: pin ? "pin" : null,
    }),
  setSidebarMode: (mode) => set({ sidebarMode: mode }),
}));
