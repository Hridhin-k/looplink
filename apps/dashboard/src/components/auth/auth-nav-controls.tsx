"use client";

import Link from "next/link";

import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";

/**
 * Top-nav auth controls: account link + Sign out (dashboard is always authenticated).
 */
export function AuthNavControls() {
  const { isLoading, user, logout } = useAuth();

  if (isLoading || user === null) {
    return <div className="hidden h-8 w-20 sm:block" aria-hidden />;
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/account"
        className="hidden max-w-[12rem] truncate text-caption text-warm-granite transition-machine hover:text-bone sm:inline"
      >
        {user.email ?? "Account"}
      </Link>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          void logout().then(() => {
            window.location.assign("/login");
          });
        }}
      >
        Sign out
      </Button>
    </div>
  );
}
