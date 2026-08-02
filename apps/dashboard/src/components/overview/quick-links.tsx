"use client";

import Link from "next/link";
import {
  BookOpenIcon,
  ListTreeIcon,
  NetworkIcon,
  SettingsIcon,
} from "lucide-react";

const LINKS = [
  {
    href: "/tunnels",
    title: "Tunnels",
    description: "See live forward sessions for this workspace.",
    icon: NetworkIcon,
  },
  {
    href: "/requests",
    title: "Requests",
    description: "Search, filter, and open any captured exchange.",
    icon: ListTreeIcon,
  },
  {
    href: "/workspace",
    title: "Workspace",
    description: "API keys, members, and invites.",
    icon: SettingsIcon,
  },
  {
    href: "/docs/getting-started",
    title: "Docs",
    description: "A–Z install, tunnel, inspect, and collaborate.",
    icon: BookOpenIcon,
  },
] as const;

/**
 * Production hub strip — routes users into the rest of Mission Control + docs.
 */
export function OverviewQuickLinks() {
  return (
    <section aria-label="Quick links" className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <p className="text-eyebrow text-ash">Where to go next</p>
        <Link
          href="/docs"
          className="text-[12px] font-medium text-ash transition-colors hover:text-pure-white"
        >
          Full documentation →
        </Link>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {LINKS.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className="group flex h-full flex-col gap-2 rounded-md border border-slate/80 bg-ink/40 p-4 shadow-hairline transition-colors duration-150 hover:border-ash hover:bg-ink"
              >
                <span className="inline-flex size-7 items-center justify-center rounded-md border border-slate text-mist group-hover:border-ash group-hover:text-pure-white">
                  <Icon className="size-3.5" aria-hidden />
                </span>
                <span className="text-[14px] font-medium tracking-[-0.01em] text-pure-white">
                  {item.title}
                </span>
                <span className="text-[13px] leading-snug text-smoke">{item.description}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
