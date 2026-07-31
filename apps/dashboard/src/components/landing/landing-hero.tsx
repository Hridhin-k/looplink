import Link from "next/link";

/**
 * Hero: brand-first Badger pitch + product frame (UI-in-UI).
 */
export function LandingHero() {
  return (
    <section className="relative overflow-hidden border-b border-ash-stroke/40">
      <div className="mx-auto grid w-full max-w-[1200px] gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:gap-10 lg:py-24">
        <div className="min-w-0">
          <p className="font-mono text-[12px] tracking-[0.18em] text-bone uppercase">Badger</p>
          <h1 className="mt-4 max-w-xl text-[44px] leading-[1.12] tracking-[-1.1px] text-bone sm:text-[72px] sm:leading-none sm:tracking-[-2.88px]">
            Ship tunnels.
            <br />
            Inspect everything.
          </h1>
          <p className="mt-5 max-w-md text-base leading-normal text-warm-granite">
            Public HTTPS for local servers — start anonymously from the CLI, then sign in for live
            request capture, replay, and workspace-scoped observability.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/login"
              className="inline-flex h-10 items-center rounded-[3px] bg-[#1f1d1c] px-3.5 text-sm text-bone transition-colors duration-150 hover:bg-carbon-lift"
            >
              Open dashboard
            </Link>
            <a
              href="#start"
              className="inline-flex h-10 items-center border border-ash-stroke px-3.5 text-sm text-bone transition-colors duration-150 hover:border-pale-stone hover:text-chalk"
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
      className="animate-[sfDashboardFrameIn_0.35s_cubic-bezier(0.4,0,0.2,1)_both] rounded-[10px] border border-ash-stroke bg-[#0d0d0d]"
      aria-hidden
    >
      <div className="flex items-center gap-2 border-b border-carbon-lift px-4 py-3">
        <span className="size-2.5 rounded-full bg-[#ff5f57]" />
        <span className="size-2.5 rounded-full bg-[#febc2e]" />
        <span className="size-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-3 inline-flex items-center gap-2 font-mono text-[12px] tracking-[-0.02em] text-pale-stone uppercase">
          <span className="size-1.5 rounded-full bg-signal-orange" />
          Inspector · live
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4">
        <MetricTile label="Requests" value="1,284" trend="up" />
        <MetricTile label="Error rate" value="0.4%" trend="up" />
        <MetricTile label="p95" value="86ms" trend="down" />
        <MetricTile label="Tunnels" value="3" trend="up" />
      </div>

      <div className="border-t border-carbon-lift p-4">
        <p className="mb-3 font-mono text-[12px] tracking-[-0.02em] text-pale-stone uppercase">
          Recent
        </p>
        <ul className="space-y-2 font-mono text-xs text-warm-granite">
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
  const stroke = trend === "up" ? "#a0ca92" : "#ee6018";
  return (
    <div className="border-b border-r border-carbon-lift p-5 last:border-r-0 sm:[&:nth-child(4n)]:border-r-0">
      <p className="font-mono text-[12px] tracking-[-0.24px] text-pale-stone uppercase">{label}</p>
      <p className="mt-2 text-[28px] leading-none tracking-[-1.12px] text-bone sm:text-[36px]">
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
    <li className="flex items-center gap-3 border-b border-carbon-lift/80 pb-2 last:border-0 last:pb-0">
      <span className="w-10 text-bone">{method}</span>
      <span className="min-w-0 flex-1 truncate text-bone">{path}</span>
      <span className={status.startsWith("2") ? "text-metric-green" : "text-signal-orange"}>
        {status}
      </span>
      <span className="w-12 text-right">{latency}</span>
    </li>
  );
}
