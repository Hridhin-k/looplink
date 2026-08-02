"use client";

import Link from "next/link";

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
 * Feature grid — ink surfaces with hairline elevation on void.
 */
export function LandingFeatures() {
  return (
    <section id="features" className="scroll-mt-20 border-b border-slate/60 py-16 sm:py-24">
      <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6">
        <div className="max-w-xl">
          <p className="text-eyebrow">Product</p>
          <h2 className="mt-3 text-[32px] leading-[1.1] font-medium tracking-tight text-pure-white sm:text-[36px]">
            Built for the tunnel loop
          </h2>
          <p className="mt-3 text-base text-smoke">
            Anonymous tunnels work immediately. Sign in when you need the dashboard, shared
            workspaces, and team traffic.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {FEATURES.map((feature) => (
            <article
              key={feature.eyebrow}
              className="rounded-lg bg-ink p-6 shadow-hairline transition-machine hover:shadow-key"
            >
              <p className="text-eyebrow">{feature.eyebrow}</p>
              <h3 className="mt-3 text-xl font-medium tracking-tight text-pure-white">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-normal text-smoke">{feature.body}</p>
              <Link
                href="/docs/getting-started"
                className="mt-5 inline-flex text-[13px] font-medium text-ash transition-colors duration-150 hover:text-pure-white"
              >
                Read the guide →
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
