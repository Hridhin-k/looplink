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
      transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        "sticky top-0 hidden h-svh shrink-0 flex-col border-r border-ash-stroke bg-obsidian-canvas text-bone lg:flex",
      )}
    >
      <div
        className={cn(
          "flex h-16 items-center gap-2 px-3",
          collapsed ? "justify-center" : "justify-between",
        )}
      >
        {!collapsed ? (
          <p className="font-mono text-[12px] tracking-[0.18em] text-bone uppercase">Badger</p>
        ) : (
          <span className="font-mono text-[12px] tracking-[0.18em] text-bone uppercase" aria-hidden>
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
        <div className="border-t border-ash-stroke p-2">
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
