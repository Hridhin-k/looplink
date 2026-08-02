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
    <section className="border-b border-slate/60 py-16 sm:py-20" aria-label="Capabilities">
      <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-center gap-x-10 gap-y-6 px-4 sm:justify-between sm:px-6">
        {PARTNERS.map((name) => (
          <span
            key={name}
            className="font-mono text-[10px] tracking-[0.05em] text-ash uppercase"
          >
            {name}
          </span>
        ))}
      </div>
    </section>
  );
}
