import { create } from "zustand";
import type { LocationPin, TimelineEvent } from "@/types/app";

export type SidebarMode = "vault" | "pin" | "export" | null;

interface UIState {
  selectedPin: LocationPin | null;
  activeEvent: TimelineEvent | null;
  sidebarMode: SidebarMode;
  setSelectedPin: (pin: LocationPin | null) => void;
  setActiveEvent: (event: TimelineEvent | null) => void;
  setSidebarMode: (mode: SidebarMode) => void;
}

export const useUIStore = create<UIState>((set) => ({
  selectedPin: null,
  activeEvent: null,
  sidebarMode: null,
  setSelectedPin: (pin) =>
    set({
      selectedPin: pin,
      sidebarMode: pin ? "pin" : null,
    }),
  setActiveEvent: (event) => set({ activeEvent: event }),
  setSidebarMode: (mode) => set({ sidebarMode: mode }),
}));
