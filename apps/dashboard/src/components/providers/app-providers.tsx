"use client";

import type { ReactNode } from "react";

import { TooltipProvider } from "@/components/ui/tooltip";

import { DashboardSocketProvider } from "./dashboard-socket-provider";
import { QueryProvider } from "./query-provider";
import { ThemeProvider } from "./theme-provider";

/**
 * Root client providers: theme, React Query, tooltips, and live dashboard socket.
 */
export function AppProviders({ children }: { readonly children: ReactNode }) {
  return (
    <ThemeProvider>
      <QueryProvider>
        <TooltipProvider>
          <DashboardSocketProvider>{children}</DashboardSocketProvider>
        </TooltipProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
