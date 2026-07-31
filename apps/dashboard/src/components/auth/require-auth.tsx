"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Renders children only when authenticated; otherwise redirects to `/login`.
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
      <div
        className="flex min-h-svh w-full flex-col items-center justify-center gap-4 bg-obsidian-canvas px-4"
        aria-busy="true"
        aria-label="Checking session"
      >
        <p className="font-mono text-[12px] tracking-[0.18em] text-pale-stone uppercase">Badger</p>
        <div className="w-full max-w-sm space-y-3">
          <Skeleton className="h-3 w-24 bg-carbon-lift" />
          <Skeleton className="h-10 w-full bg-carbon-lift" />
          <Skeleton className="h-24 w-full bg-carbon-lift" />
        </div>
      </div>
    );
  }

  return children;
}
