"use client";

import { MenuIcon, PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import { usePathname } from "next/navigation";

import { AuthNavControls } from "@/components/auth/auth-nav-controls";
import { ConnectionIndicator } from "@/components/layout/connection-indicator";
import { APP_NAV_ITEMS } from "@/components/layout/nav-items";
import { WorkspaceSelector } from "@/components/workspaces/workspace-selector";
import { Button } from "@/components/ui/button";
import { useUiStore } from "@/stores/ui-store";

/**
 * Top bar: menu (mobile/tablet), page title, workspace, auth, live status.
 */
export function TopNav() {
  const pathname = usePathname();
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen);

  const current = APP_NAV_ITEMS.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));

  let title = current?.label ?? "Overview";
  if (pathname.startsWith("/requests/") && pathname !== "/requests") {
    title = "Request details";
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-ash-stroke bg-obsidian-canvas/90 px-3 sm:px-4 md:px-6">
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
        className="hidden lg:inline-flex"
        aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        onClick={toggleSidebar}
      >
        {sidebarCollapsed ? <PanelLeftOpenIcon /> : <PanelLeftCloseIcon />}
      </Button>

      <div className="min-w-0 flex-1">
        <p className="font-mono text-[12px] tracking-[-0.02em] text-pale-stone uppercase">
          {title}
        </p>
      </div>

      <WorkspaceSelector />
      <AuthNavControls />
      <ConnectionIndicator className="hidden sm:inline-flex" />
    </header>
  );
}
