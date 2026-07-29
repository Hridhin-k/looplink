"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Renders children only when authenticated; otherwise redirects to `/login`.
 *
 * Existing inspector routes are intentionally not wrapped by this component.
 */
export function RequireAuth({
  children,
  redirectTo = "/login",
}: {
  readonly children: ReactNode;
  readonly redirectTo?: string;
}) {
  const router = useRouter();
  const { isLoading, session } = useAuth();

  useEffect(() => {
    if (!isLoading && session === null) {
      const next = encodeURIComponent(
        typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : "/",
      );
      router.replace(`${redirectTo}?next=${next}`);
    }
  }, [isLoading, redirectTo, router, session]);

  if (isLoading || session === null) {
    return (
      <div className="space-y-3 py-8" aria-busy="true" aria-label="Checking session">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full max-w-md" />
      </div>
    );
  }

  return children;
}
