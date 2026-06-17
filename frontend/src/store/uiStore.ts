import { create } from "zustand";

interface UIState {
  gridDensity: "2x2" | "3x3" | "4x4";
  viewMode: "grid" | "list" | "table";
  selectedEventId: string | null;
  isEventPanelOpen: boolean;
  setGridDensity: (density: "2x2" | "3x3" | "4x4") => void;
  setViewMode: (mode: "grid" | "list" | "table") => void;
  setSelectedEventId: (id: string | null) => void;
  setEventPanelOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  gridDensity: "2x2",
  viewMode: "grid",
  selectedEventId: null,
  isEventPanelOpen: false,
  setGridDensity: (gridDensity) => set({ gridDensity }),
  setViewMode: (viewMode) => set({ viewMode }),
  setSelectedEventId: (selectedEventId) => set({ selectedEventId, isEventPanelOpen: selectedEventId !== null }),
  setEventPanelOpen: (isEventPanelOpen) => set({ isEventPanelOpen }),
}));
