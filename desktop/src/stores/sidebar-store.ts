import { create } from "zustand";

type SidebarPanel = "files" | "search" | "chat" | "settings";

interface SidebarState {
  activePanel: SidebarPanel;
  setActivePanel: (panel: SidebarPanel) => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
  activePanel: "files",
  setActivePanel: (panel) => set({ activePanel: panel }),
}));
