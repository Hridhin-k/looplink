"use client";

import type { ReactNode } from "react";

import { TooltipProvider } from "@/components/ui/tooltip";

import { AuthProvider } from "./auth-provider";
import { QueryProvider } from "./query-provider";
import { ThemeProvider } from "./theme-provider";
import { WorkspaceProvider } from "./workspace-provider";

/**
 * Root client providers for every route (landing + dashboard).
 *
 * Live dashboard WebSocket is mounted only under `(dashboard)` so public
 * pages never attempt token refresh / socket connect.
 */
export function AppProviders({ children }: { readonly children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <QueryProvider>
          <WorkspaceProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </WorkspaceProvider>
        </QueryProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
