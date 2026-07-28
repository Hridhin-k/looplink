"use client";

import { MenuIcon, PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import { usePathname } from "next/navigation";

import { ConnectionIndicator } from "@/components/layout/connection-indicator";
import { APP_NAV_ITEMS } from "@/components/layout/nav-items";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useUiStore } from "@/stores/ui-store";

/**
 * Top bar: menu (mobile/tablet), page title, live status, theme.
 */
export function TopNav() {
  const pathname = usePathname();
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen);

  const current = APP_NAV_ITEMS.find((item) =>
    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href),
  );

  let title = current?.label ?? "Overview";
  if (pathname.startsWith("/requests/") && pathname !== "/requests") {
    title = "Request details";
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border/80 bg-background/80 px-3 backdrop-blur-md sm:px-4 md:px-6">
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
        <h1 className="truncate font-heading text-base tracking-tight sm:text-lg">{title}</h1>
      </div>

      <ConnectionIndicator className="hidden sm:inline-flex" />
      <ThemeToggle />
    </header>
  );
}
