import Link from "next/link";

/**
 * Closing CTA — bone card on dark ground.
 *
 * Separates anonymous CLI tunnels from dashboard login.
 */
export function LandingCta() {
  return (
    <section id="start" className="scroll-mt-20 py-16 sm:py-24">
      <div className="mx-auto flex w-full max-w-[1200px] justify-center px-4 sm:px-6">
        <div className="relative w-full max-w-[480px] overflow-hidden rounded-[10px] bg-bone p-6 text-obsidian-canvas">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
            }}
            aria-hidden
          />
          <div className="relative">
            <p className="inline-flex items-center gap-2 font-mono text-[12px] tracking-[-0.02em] uppercase">
              <span className="size-1.5 rounded-full bg-signal-orange" aria-hidden />
              Get started
            </p>
            <h2 className="mt-3 text-[36px] leading-[1.1] tracking-[-1.12px]">
              Tunnel now. Dashboard when you need it.
            </h2>
            <p className="mt-3 text-sm leading-normal text-obsidian-canvas/70">
              Anonymous tunnels need no account. Sign in only for inspector, workspaces, and team
              traffic.
            </p>
            <pre className="mt-5 overflow-x-auto rounded-[3px] bg-obsidian-canvas p-4 font-mono text-xs leading-relaxed text-bone">
              {`# anonymous — works immediately
badger 3000

# optional — workspace + dashboard
badger login`}
            </pre>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="inline-flex h-9 items-center rounded-[3px] bg-obsidian-canvas px-3.5 text-sm text-bone transition-colors duration-150 hover:bg-carbon-lift"
              >
                Open dashboard
              </Link>
              <a
                href="#features"
                className="inline-flex h-9 items-center text-sm text-obsidian-canvas/70 transition-colors duration-150 hover:text-obsidian-canvas"
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
