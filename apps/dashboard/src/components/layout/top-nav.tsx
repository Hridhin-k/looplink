"use client";

import { MenuIcon, PanelLeftCloseIcon, PanelLeftOpenIcon, SearchIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { AuthNavControls } from "@/components/auth/auth-nav-controls";
import { ConnectionIndicator } from "@/components/layout/connection-indicator";
import { APP_NAV_ITEMS } from "@/components/layout/nav-items";
import { WorkspaceSelector } from "@/components/workspaces/workspace-selector";
import { Button } from "@/components/ui/button";
import { useCommandPaletteStore } from "@/stores/command-palette-store";
import { useUiStore } from "@/stores/ui-store";

/**
 * Top bar: menu (mobile/tablet), page title, workspace, auth, live status.
 */
export function TopNav() {
  const pathname = usePathname();
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen);
  const setPaletteOpen = useCommandPaletteStore((s) => s.setOpen);
  const [modKey, setModKey] = useState("⌘");

  useEffect(() => {
    const apple =
      /Mac|iPhone|iPad|iPod/i.test(navigator.platform) || /Mac OS/i.test(navigator.userAgent);
    setModKey(apple ? "⌘" : "Ctrl");
  }, []);

  const current = APP_NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  let title = current?.label ?? "Overview";
  if (pathname.startsWith("/requests/") && pathname !== "/requests") {
    title = "Request details";
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-ash-stroke bg-obsidian-canvas/95 px-4 backdrop-blur-sm sm:h-16 sm:px-6 md:px-8">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="lg:hidden"
        aria-label="Open navigation"
        onClick={() => setMobileNavOpen(true)}
      >
        <MenuIcon />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="hidden text-warm-granite hover:text-bone lg:inline-flex"
        aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        onClick={toggleSidebar}
      >
        {sidebarCollapsed ? <PanelLeftOpenIcon /> : <PanelLeftCloseIcon />}
      </Button>

      <div className="min-w-0 flex-1">
        <p className="text-caption text-pale-stone">{title}</p>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="hidden max-w-[220px] flex-1 justify-start gap-2 border-ash-stroke bg-obsidian-canvas text-warm-granite hover:text-bone sm:inline-flex md:max-w-[260px]"
        onClick={() => setPaletteOpen(true)}
        aria-label="Open command palette"
      >
        <SearchIcon className="size-3.5" />
        <span className="truncate">Search…</span>
        <kbd className="ml-auto rounded-[3px] border border-ash-stroke px-1.5 py-0.5 font-mono text-[10px] text-pale-stone">
          {modKey}K
        </kbd>
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="text-warm-granite hover:text-bone sm:hidden"
        aria-label="Open command palette"
        onClick={() => setPaletteOpen(true)}
      >
        <SearchIcon />
      </Button>

      <WorkspaceSelector />
      <AuthNavControls />
      <ConnectionIndicator className="hidden sm:inline-flex" />
    </header>
  );
}
