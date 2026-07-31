const PARTNERS = [
  "CLI",
  "Webhooks",
  "OAuth",
  "Replay",
  "Workspaces",
  "Inspector",
  "HTTP",
  "WebSocket",
] as const;

/**
 * Trust / capability strip beneath the hero.
 */
export function LandingTrustStrip() {
  return (
    <section className="border-b border-ash-stroke/40 py-16 sm:py-24" aria-label="Capabilities">
      <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-center gap-x-10 gap-y-6 px-4 sm:justify-between sm:px-6">
        {PARTNERS.map((name) => (
          <span
            key={name}
            className="font-mono text-[12px] tracking-[0.14em] text-warm-granite uppercase"
          >
            {name}
          </span>
        ))}
      </div>
    </section>
  );
}
