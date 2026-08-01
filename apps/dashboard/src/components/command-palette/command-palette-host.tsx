"use client";

import { useEffect } from "react";

import { CommandPalette } from "@/components/command-palette/command-palette";
import { useCommandPaletteStore } from "@/stores/command-palette-store";

/**
 * Mounts the global palette and binds ⌘K / Ctrl+K.
 */
export function CommandPaletteHost() {
  const toggle = useCommandPaletteStore((s) => s.toggle);
  const setOpen = useCommandPaletteStore((s) => s.setOpen);
  const open = useCommandPaletteStore((s) => s.open);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const isModK =
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        event.key.toLowerCase() === "k";

      if (isModK) {
        event.preventDefault();
        toggle();
        return;
      }

      if (event.key === "Escape" && open) {
        event.preventDefault();
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle, setOpen, open]);

  return <CommandPalette />;
}
