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
        className="w-[min(100%,18rem)] bg-sidebar p-0 text-sidebar-foreground"
      >
        <SheetHeader className="border-b border-sidebar-border">
          <SheetTitle className="font-heading text-left">Badger</SheetTitle>
          <SheetDescription className="text-left">Navigate the inspector</SheetDescription>
        </SheetHeader>
        <div className="px-2 py-3">
          <SidebarNav onNavigate={() => setMobileNavOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
