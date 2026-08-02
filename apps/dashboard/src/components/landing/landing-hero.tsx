import Link from "next/link";

/**
 * Hero: brand-first Badger pitch + product frame (UI-in-UI).
 * Atmosphere blues are splash-only; CTAs stay Mist/Iron.
 */
export function LandingHero() {
  return (
    <section className="relative overflow-hidden border-b border-slate/60">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 70% 20%, color-mix(in oklab, var(--deep-space) 55%, transparent), transparent 70%), radial-gradient(ellipse 40% 30% at 85% 60%, color-mix(in oklab, var(--cobalt-edge) 25%, transparent), transparent 65%)",
        }}
        aria-hidden
      />

      <div className="relative mx-auto grid w-full max-w-[1200px] gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:gap-10 lg:py-24">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.05em] text-ash uppercase">
            <span className="text-coral-pulse" aria-hidden>
              ◆
            </span>
            Badger
          </p>
          <h1 className="mt-4 max-w-xl text-[44px] leading-[1.12] font-medium tracking-[-0.02em] text-pure-white sm:text-[64px] sm:leading-none sm:font-normal">
            Ship tunnels.
            <br />
            Inspect everything.
          </h1>
          <p className="mt-5 max-w-md text-base leading-normal text-smoke">
            Public HTTPS for local servers — start anonymously from the CLI, then sign in for live
            request capture, replay, and workspace-scoped observability.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/login"
              className="inline-flex h-10 items-center rounded-md bg-mist px-3 text-[13px] font-medium text-iron transition-colors duration-150 hover:bg-pure-white"
            >
              Open dashboard
            </Link>
            <a
              href="#start"
              className="inline-flex h-10 items-center rounded-md border border-slate px-3 text-[13px] font-medium text-ash transition-colors duration-150 hover:border-ash hover:text-pure-white"
            >
              View CLI →
            </a>
          </div>
        </div>

        <ProductFrame />
      </div>
    </section>
  );
}

function ProductFrame() {
  return (
    <div
      className="animate-[sfDashboardFrameIn_0.35s_cubic-bezier(0.4,0,0.2,1)_both] overflow-hidden rounded-lg bg-ink shadow-key"
      aria-hidden
    >
      <div className="flex items-center gap-2 border-b border-slate/80 px-4 py-3">
        <span className="size-2.5 rounded-full bg-graphite" />
        <span className="size-2.5 rounded-full bg-graphite" />
        <span className="size-2.5 rounded-full bg-graphite" />
        <span className="ml-3 inline-flex items-center gap-2 font-mono text-[12px] tracking-[0.05em] text-ash uppercase">
          <span className="size-1.5 animate-mc-live rounded-full bg-success-green" />
          Inspector · live
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4">
        <MetricTile label="Requests" value="1,284" trend="up" />
        <MetricTile label="Error rate" value="0.4%" trend="up" />
        <MetricTile label="p95" value="86ms" trend="down" />
        <MetricTile label="Tunnels" value="3" trend="up" />
      </div>

      <div className="border-t border-slate/80 p-4">
        <p className="mb-3 font-mono text-[10px] tracking-[0.05em] text-ash uppercase">Recent</p>
        <ul className="space-y-2 font-mono text-xs text-smoke">
          <RequestRow method="POST" path="/webhooks/stripe" status="200" latency="42ms" />
          <RequestRow method="GET" path="/api/v1/me" status="200" latency="18ms" />
          <RequestRow method="PUT" path="/checkout/session" status="502" latency="1.2s" />
          <RequestRow method="GET" path="/health" status="200" latency="9ms" />
        </ul>
      </div>
    </div>
  );
}

function MetricTile({
  label,
  value,
  trend,
}: {
  readonly label: string;
  readonly value: string;
  readonly trend: "up" | "down";
}) {
  const stroke = trend === "up" ? "#59d499" : "#ff6363";
  return (
    <div className="border-b border-r border-slate/80 p-5 last:border-r-0 sm:[&:nth-child(4n)]:border-r-0">
      <p className="font-mono text-[10px] tracking-[0.05em] text-ash uppercase">{label}</p>
      <p className="mt-2 text-[28px] leading-none font-medium tracking-tight text-pure-white sm:text-[32px]">
        {value}
      </p>
      <svg className="mt-3 h-8 w-full" viewBox="0 0 120 32" fill="none" aria-hidden>
        <path
          d={
            trend === "up"
              ? "M0 24 L20 20 L40 22 L60 12 L80 14 L100 6 L120 8"
              : "M0 8 L20 10 L40 14 L60 12 L80 20 L100 18 L120 24"
          }
          stroke={stroke}
          strokeWidth="1"
        />
      </svg>
    </div>
  );
}

function RequestRow({
  method,
  path,
  status,
  latency,
}: {
  readonly method: string;
  readonly path: string;
  readonly status: string;
  readonly latency: string;
}) {
  return (
    <li className="flex items-center gap-3 border-b border-slate/50 pb-2 last:border-0 last:pb-0">
      <span className="w-10 text-mist">{method}</span>
      <span className="min-w-0 flex-1 truncate text-mist">{path}</span>
      <span className={status.startsWith("2") ? "text-success-green" : "text-coral-pulse"}>
        {status}
      </span>
      <span className="w-12 text-right text-ash">{latency}</span>
    </li>
  );
}
