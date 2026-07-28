"use client";

import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import { motion } from "framer-motion";

import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";

/**
 * Persistent sidebar for large screens (`lg+`). Collapses to icon rail.
 */
export function AppSidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  return (
    <motion.aside
      aria-label="Sidebar"
      initial={false}
      animate={{ width: collapsed ? 72 : 240 }}
      transition={{ type: "spring", stiffness: 320, damping: 32 }}
      className={cn(
        "sticky top-0 hidden h-svh shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex",
      )}
    >
      <div
        className={cn(
          "flex h-14 items-center gap-2 px-3",
          collapsed ? "justify-center" : "justify-between",
        )}
      >
        {!collapsed ? (
          <p className="font-heading truncate text-base tracking-tight">Badger</p>
        ) : (
          <span className="font-heading text-sm tracking-tight" aria-hidden>
            B
          </span>
        )}
        {!collapsed ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Collapse sidebar"
            onClick={toggleSidebar}
          >
            <PanelLeftCloseIcon />
          </Button>
        ) : null}
      </div>

      <Separator className="opacity-60" />

      <div className={cn("flex-1 overflow-y-auto px-2 py-3", collapsed && "px-1.5")}>
        <SidebarNav collapsed={collapsed} />
      </div>

      {collapsed ? (
        <div className="border-t border-sidebar-border p-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="w-full"
            aria-label="Expand sidebar"
            onClick={toggleSidebar}
          >
            <PanelLeftOpenIcon />
          </Button>
        </div>
      ) : null}
    </motion.aside>
  );
}
