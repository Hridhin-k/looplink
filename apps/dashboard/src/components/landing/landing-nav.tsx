"use client";

import Link from "next/link";

import { useAuth } from "@/components/providers/auth-provider";

/**
 * Marketing top bar — glass strip on void canvas.
 */
export function LandingNav() {
  const { isLoading, session } = useAuth();
  const signedIn = !isLoading && session !== null;

  return (
    <header className="sticky top-0 z-40 border-b border-slate/80 bg-ink/80 backdrop-blur-[18px]">
      <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center gap-6 px-4 sm:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 font-mono text-[12px] tracking-[0.18em] text-pure-white uppercase"
        >
          <span className="text-coral-pulse" aria-hidden>
            ◆
          </span>
          Badger
        </Link>

        <nav className="hidden flex-1 items-center gap-6 md:flex" aria-label="Marketing">
          <a
            href="#product"
            className="text-[13px] font-medium tracking-[0.01em] text-ash transition-colors duration-150 hover:text-pure-white"
          >
            Product
          </a>
          <a
            href="#features"
            className="text-[13px] font-medium tracking-[0.01em] text-ash transition-colors duration-150 hover:text-pure-white"
          >
            Features
          </a>
          <Link
            href="/docs"
            className="text-[13px] font-medium tracking-[0.01em] text-ash transition-colors duration-150 hover:text-pure-white"
          >
            Docs
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {signedIn ? (
            <Link
              href="/overview"
              className="inline-flex h-8 items-center rounded-md bg-mist px-3 text-[13px] font-medium text-iron transition-colors duration-150 hover:bg-pure-white"
            >
              Open dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden text-[13px] font-medium text-ash transition-colors duration-150 hover:text-pure-white sm:inline"
              >
                Sign in
              </Link>
              <Link
                href="/login"
                className="inline-flex h-8 items-center rounded-md bg-mist px-3 text-[13px] font-medium text-iron transition-colors duration-150 hover:bg-pure-white"
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
