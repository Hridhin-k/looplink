"use client";

import type { ReactNode } from "react";

import { TooltipProvider } from "@/components/ui/tooltip";

import { AuthProvider } from "./auth-provider";
import { DashboardSocketProvider } from "./dashboard-socket-provider";
import { QueryProvider } from "./query-provider";
import { ThemeProvider } from "./theme-provider";
import { WorkspaceProvider } from "./workspace-provider";

/**
 * Root client providers: theme, auth, React Query, tooltips, and live dashboard socket.
 */
export function AppProviders({ children }: { readonly children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <QueryProvider>
          <WorkspaceProvider>
            <TooltipProvider>
              <DashboardSocketProvider>{children}</DashboardSocketProvider>
            </TooltipProvider>
          </WorkspaceProvider>
        </QueryProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
