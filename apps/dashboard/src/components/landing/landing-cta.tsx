import Link from "next/link";

/**
 * Closing CTA — ink key surface on void (no light-mode card).
 * Separates anonymous CLI tunnels from dashboard login.
 */
export function LandingCta() {
  return (
    <section id="start" className="scroll-mt-20 py-16 sm:py-24">
      <div className="mx-auto flex w-full max-w-[1200px] justify-center px-4 sm:px-6">
        <div className="relative w-full max-w-[480px] overflow-hidden rounded-lg bg-ink p-6 shadow-key">
          <div className="relative">
            <p className="inline-flex items-center gap-2 text-eyebrow">
              <span className="size-1.5 rounded-full bg-coral-pulse" aria-hidden />
              Get started
            </p>
            <h2 className="mt-3 text-[32px] leading-[1.1] font-medium tracking-tight text-pure-white">
              Tunnel now. Dashboard when you need it.
            </h2>
            <p className="mt-3 text-sm leading-normal text-smoke">
              Anonymous tunnels need no account. Sign in only for inspector, workspaces, and team
              traffic.
            </p>
            <pre className="mt-5 overflow-x-auto rounded-md bg-void-black p-4 font-mono text-xs leading-relaxed text-mist shadow-hairline">
              {`# anonymous — works immediately
badger 3000

# optional — workspace + dashboard
badger login`}
            </pre>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="inline-flex h-9 items-center rounded-md bg-mist px-3 text-[13px] font-medium text-iron transition-colors duration-150 hover:bg-pure-white"
              >
                Open dashboard
              </Link>
              <a
                href="#features"
                className="inline-flex h-9 items-center rounded-md border border-slate px-3 text-[13px] font-medium text-ash transition-colors duration-150 hover:border-ash hover:text-pure-white"
              >
                See features →
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
