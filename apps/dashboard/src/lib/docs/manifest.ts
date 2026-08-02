import type { DocsArticleMeta } from "@/lib/docs/types";

/**
 * Docs navigation metadata only — safe for client shells.
 * Keep article bodies in `articles.tsx` so they are not pulled into the Worker via DocsShell.
 */
export const DOCS_MANIFEST: readonly DocsArticleMeta[] = [
  {
    slug: "getting-started",
    title: "Getting started",
    description: "A to Z path from install to your first inspected request.",
    order: 1,
    section: "start",
  },
  {
    slug: "installation",
    title: "Installation",
    description: "CLI install, monorepo local stack, and environment variables.",
    order: 2,
    section: "start",
  },
  {
    slug: "authentication",
    title: "Authentication",
    description: "OAuth, API keys, sessions, and what requires sign-in.",
    order: 3,
    section: "start",
  },
  {
    slug: "cli",
    title: "CLI reference",
    description: "Commands, menus, flags, and local vs hosted server.",
    order: 4,
    section: "start",
  },
  {
    slug: "tunnels",
    title: "Tunnels",
    description: "Public URLs, live sessions, anonymous mode, and the Tunnels page.",
    order: 5,
    section: "product",
  },
  {
    slug: "overview",
    title: "Overview",
    description: "Live Activity Center — what is happening right now.",
    order: 6,
    section: "product",
  },
  {
    slug: "requests",
    title: "Request explorer",
    description: "Search, filter, keyboard shortcuts, and detail pages.",
    order: 7,
    section: "product",
  },
  {
    slug: "replay",
    title: "Replay",
    description: "Re-send a captured request through the live tunnel.",
    order: 8,
    section: "product",
  },
  {
    slug: "statistics",
    title: "Statistics",
    description: "Insight-first metrics and supporting charts.",
    order: 9,
    section: "product",
  },
  {
    slug: "command-palette",
    title: "Command palette",
    description: "⌘K navigation, search, workspace switch, and replay.",
    order: 10,
    section: "product",
  },
  {
    slug: "webhooks",
    title: "Webhook debugging",
    description: "End-to-end loop for provider webhooks through a Badger tunnel.",
    order: 14,
    section: "product",
  },
  {
    slug: "workspaces",
    title: "Workspaces",
    description: "Personal vs shared, invites, members, and switching.",
    order: 11,
    section: "collaborate",
  },
  {
    slug: "api-keys",
    title: "API keys",
    description: "CI authentication without browser OAuth.",
    order: 12,
    section: "collaborate",
  },
  {
    slug: "account",
    title: "Account & security",
    description: "Identity, verification, sessions, and danger zone.",
    order: 13,
    section: "collaborate",
  },
  {
    slug: "production-checklist",
    title: "Production checklist",
    description: "Hardening for a self-hosted or cloud Badger deployment.",
    order: 15,
    section: "reference",
  },
  {
    slug: "troubleshooting",
    title: "Troubleshooting",
    description: "Common failures and how to fix them.",
    order: 16,
    section: "reference",
  },
  {
    slug: "glossary",
    title: "Glossary A–Z",
    description: "Alphabetized terms for Badger concepts.",
    order: 17,
    section: "reference",
  },
] as const;

export function listDocsManifest(): readonly DocsArticleMeta[] {
  return [...DOCS_MANIFEST].sort((a, b) => a.order - b.order);
}
