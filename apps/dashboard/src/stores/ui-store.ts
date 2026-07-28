import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UiState {
  readonly sidebarCollapsed: boolean;
  readonly mobileNavOpen: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setMobileNavOpen: (open: boolean) => void;
  toggleMobileNav: () => void;
}

/**
 * Shell UI preferences (sidebar collapse persisted; mobile drawer is ephemeral).
 */
export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      sidebarCollapsed: false,
      mobileNavOpen: false,
      toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
      toggleMobileNav: () => set({ mobileNavOpen: !get().mobileNavOpen }),
    }),
    {
      name: "badger-dashboard-ui",
      partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed }),
    },
  ),
);
