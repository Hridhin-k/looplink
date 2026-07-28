"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

/**
 * TanStack Query provider with dashboard-friendly defaults.
 */
export function QueryProvider({ children }: { readonly children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5_000,
            // Avoid refetch storms / Next overlay noise when the API is down.
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => {
              if (failureCount >= 1) {
                return false;
              }
              const status =
                error !== null &&
                typeof error === "object" &&
                "status" in error &&
                typeof (error as { status: unknown }).status === "number"
                  ? (error as { status: number }).status
                  : undefined;
              // Retry once for transient server errors only — never for network/4xx.
              return status !== undefined && status >= 500;
            },
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
