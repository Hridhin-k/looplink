"use client";

import type { ReactNode } from "react";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { ConnectionBanner } from "@/components/layout/connection-banner";
import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { CommandPaletteHost } from "@/components/command-palette/command-palette-host";
import { PageEnter } from "@/components/motion/page-enter";

/**
 * Application chrome: sidebar + top nav + scrollable content.
 *
 * - Desktop (`lg+`): persistent sidebar (collapsible)
 * - Tablet / mobile: off-canvas sheet via top-nav menu
 */
export function AppShell({ children }: { readonly children: ReactNode }) {
  return (
    <div className="flex min-h-svh w-full bg-obsidian-canvas">
      <a href="#dashboard-main" className="skip-link">
        Skip to content
      </a>
      <AppSidebar />
      <MobileSidebar />
      <CommandPaletteHost />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav />
        <ConnectionBanner />
        <main
          id="dashboard-main"
          tabIndex={-1}
          className="relative flex-1 overflow-y-auto scroll-smooth motion-reduce:scroll-auto outline-none focus-visible:outline-none"
        >
          <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 sm:py-8 md:px-8 md:py-10">
            <PageEnter>{children}</PageEnter>
          </div>
        </main>
      </div>
    </div>
  );
}
