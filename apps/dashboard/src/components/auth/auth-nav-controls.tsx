"use client";

import Link from "next/link";

import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";

/**
 * Top-nav auth controls: Sign in, or account link + Sign out.
 */
export function AuthNavControls() {
  const { isLoading, user, logout } = useAuth();

  if (isLoading) {
    return <div className="hidden h-8 w-20 sm:block" aria-hidden />;
  }

  if (user === null) {
    return (
      <Link
        href="/login"
        className="inline-flex h-7 items-center rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/account"
        className="hidden max-w-[12rem] truncate text-sm text-muted-foreground hover:text-foreground sm:inline"
      >
        {user.email ?? "Account"}
      </Link>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          void logout();
        }}
      >
        Sign out
      </Button>
    </div>
  );
}
