import { create } from "zustand";

interface AlertState {
  isMuted: boolean;
  unreadAlertsCount: number;
  toggleMute: () => void;
  setMuted: (muted: boolean) => void;
  setUnreadAlertsCount: (count: number) => void;
  incrementUnreadCount: () => void;
  clearUnreadCount: () => void;
}

export const useAlertStore = create<AlertState>((set) => ({
  isMuted: false,
  unreadAlertsCount: 0,
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  setMuted: (isMuted) => set({ isMuted }),
  setUnreadAlertsCount: (unreadAlertsCount) => set({ unreadAlertsCount }),
  incrementUnreadCount: () => set((state) => ({ unreadAlertsCount: state.unreadAlertsCount + 1 })),
  clearUnreadCount: () => set({ unreadAlertsCount: 0 }),
}));
