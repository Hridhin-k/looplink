import { create } from "zustand";
import { persist } from "zustand/middleware";

const MAX_RECENT = 8;

interface CommandPaletteState {
  readonly open: boolean;
  readonly recentSearches: readonly string[];
  setOpen: (open: boolean) => void;
  toggle: () => void;
  addRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;
  removeRecentSearch: (query: string) => void;
}

/**
 * Global command palette open state + persisted recent searches.
 */
export const useCommandPaletteStore = create<CommandPaletteState>()(
  persist(
    (set, get) => ({
      open: false,
      recentSearches: [],
      setOpen: (open) => set({ open }),
      toggle: () => set({ open: !get().open }),
      addRecentSearch: (query) => {
        const trimmed = query.trim();
        if (trimmed.length === 0) {
          return;
        }
        const next = [
          trimmed,
          ...get().recentSearches.filter((item) => item.toLowerCase() !== trimmed.toLowerCase()),
        ].slice(0, MAX_RECENT);
        set({ recentSearches: next });
      },
      clearRecentSearches: () => set({ recentSearches: [] }),
      removeRecentSearch: (query) =>
        set({
          recentSearches: get().recentSearches.filter(
            (item) => item.toLowerCase() !== query.trim().toLowerCase(),
          ),
        }),
    }),
    {
      name: "badger-command-palette",
      partialize: (state) => ({ recentSearches: state.recentSearches }),
    },
  ),
);
