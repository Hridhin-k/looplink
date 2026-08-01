"use client";

import { SidebarNav } from "@/components/layout/sidebar-nav";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useUiStore } from "@/stores/ui-store";

/**
 * Off-canvas sidebar for tablet and mobile (`< lg`).
 */
export function MobileSidebar() {
  const open = useUiStore((s) => s.mobileNavOpen);
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen);

  return (
    <Sheet open={open} onOpenChange={setMobileNavOpen}>
      <SheetContent
        side="left"
        className="w-[min(100%,18rem)] border-ash-stroke bg-obsidian-canvas p-0 text-bone"
      >
        <SheetHeader className="border-b border-ash-stroke px-4 py-4">
          <SheetTitle className="text-left font-mono text-[12px] tracking-[0.2em] text-bone uppercase">
            Badger
          </SheetTitle>
          <SheetDescription className="text-left text-sm text-warm-granite">
            Mission Control
          </SheetDescription>
        </SheetHeader>
        <div className="px-2 py-4">
          <SidebarNav onNavigate={() => setMobileNavOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
