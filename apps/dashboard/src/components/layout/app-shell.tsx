"use client";

import type { ReactNode } from "react";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { ConnectionBanner } from "@/components/layout/connection-banner";
import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import { TopNav } from "@/components/layout/top-nav";

/**
 * Application chrome: sidebar + top nav + scrollable content.
 *
 * - Desktop (`lg+`): persistent sidebar (collapsible)
 * - Tablet / mobile: off-canvas sheet via top-nav menu
 */
export function AppShell({ children }: { readonly children: ReactNode }) {
  return (
    <div className="flex min-h-svh w-full bg-background">
      <AppSidebar />
      <MobileSidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav />
        <ConnectionBanner />
        <main className="relative flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-6xl px-3 py-5 sm:px-4 md:px-6 md:py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
