const FEATURES = [
  {
    eyebrow: "Tunnels",
    title: "Expose localhost in seconds",
    body: "Run `badger 3000` with no account for an anonymous tunnel, or sign in to attach tunnels to a workspace.",
  },
  {
    eyebrow: "Inspector",
    title: "Every request, searchable",
    body: "Method, path, headers, bodies, latency, and errors — retained and filterable so webhook debugging stays local to your team.",
  },
  {
    eyebrow: "Replay",
    title: "Replay without rebuilding",
    body: "Resend a captured exchange against the live tunnel. Verify fixes without asking the partner to fire the webhook again.",
  },
  {
    eyebrow: "Workspaces",
    title: "Personal and shared",
    body: "Sign in for a personal workspace. Create shared ones, invite members, and scope tunnels, keys, and traffic by membership.",
  },
] as const;

/**
 * Feature card row — dark bordered cards on obsidian.
 */
export function LandingFeatures() {
  return (
    <section id="features" className="scroll-mt-20 border-b border-ash-stroke/40 py-16 sm:py-24">
      <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6">
        <div className="max-w-xl">
          <p className="font-mono text-[12px] tracking-[0.14em] text-pale-stone uppercase">
            Product
          </p>
          <h2 className="mt-3 text-[36px] leading-[1.1] tracking-[-1.12px] text-bone">
            Built for the tunnel loop
          </h2>
          <p className="mt-3 text-base text-warm-granite">
            Anonymous tunnels work immediately. Sign in when you need the dashboard, shared
            workspaces, and team traffic.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {FEATURES.map((feature) => (
            <article
              key={feature.eyebrow}
              className="rounded-[10px] border border-carbon-lift p-5 transition-colors duration-150 hover:border-ash-stroke"
            >
              <p className="font-mono text-[12px] tracking-[-0.02em] text-pale-stone uppercase">
                {feature.eyebrow}
              </p>
              <h3 className="mt-3 text-xl tracking-tight text-bone">{feature.title}</h3>
              <p className="mt-2 text-sm leading-normal text-warm-granite">{feature.body}</p>
              <a
                href="#start"
                className="mt-5 inline-flex text-sm text-bone transition-colors duration-150 hover:text-chalk"
              >
                Get started →
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
