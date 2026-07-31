"use client";

import Link from "next/link";

import { useAuth } from "@/components/providers/auth-provider";

/**
 * Marketing top bar — sticky, transparent on obsidian canvas.
 */
export function LandingNav() {
  const { isLoading, session } = useAuth();
  const signedIn = !isLoading && session !== null;

  return (
    <header className="sticky top-0 z-40 border-b border-ash-stroke/60 bg-obsidian-canvas/80 backdrop-blur-sm">
      <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center gap-6 px-4 sm:px-6">
        <Link
          href="/"
          className="font-mono text-[12px] tracking-[0.18em] text-bone uppercase"
        >
          Badger
        </Link>

        <nav className="hidden flex-1 items-center gap-6 md:flex" aria-label="Marketing">
          <a
            href="#product"
            className="text-sm tracking-wide text-bone uppercase transition-colors duration-150 hover:text-chalk"
          >
            Product
          </a>
          <a
            href="#features"
            className="text-sm tracking-wide text-bone uppercase transition-colors duration-150 hover:text-chalk"
          >
            Features
          </a>
          <a
            href="#start"
            className="text-sm tracking-wide text-bone uppercase transition-colors duration-150 hover:text-chalk"
          >
            Docs
          </a>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {signedIn ? (
            <Link
              href="/overview"
              className="inline-flex h-8 items-center rounded-[3px] bg-chalk px-3.5 text-sm text-obsidian-canvas transition-colors duration-150 hover:bg-bone"
            >
              Open dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden text-sm text-warm-granite transition-colors duration-150 hover:text-bone sm:inline"
              >
                Sign in
              </Link>
              <Link
                href="/login"
                className="inline-flex h-8 items-center rounded-[3px] bg-chalk px-3.5 text-sm text-obsidian-canvas transition-colors duration-150 hover:bg-bone"
              >
                Open dashboard
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
