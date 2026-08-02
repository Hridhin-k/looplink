import Link from "next/link";

import {
  DocsCallout,
  DocsCode,
  DocsH2,
  DocsH3,
  DocsP,
  DocsSteps,
  DocsUl,
} from "@/components/docs/docs-blocks";
import type { DocsArticle } from "@/lib/docs/types";

/**
 * Production documentation articles — routed under `/docs/[slug]`.
 */
export const DOCS_ARTICLES: readonly DocsArticle[] = [
  {
    slug: "getting-started",
    title: "Getting started",
    description: "A to Z path from install to your first inspected request.",
    order: 1,
    section: "start",
    body: (
      <>
        <DocsP>
          Badger exposes a local HTTP server through a public HTTPS URL and captures
          traffic in a live dashboard. The CLI opens the tunnel. The dashboard is for
          inspect, search, replay, statistics, and workspace collaboration.
        </DocsP>
        <DocsCallout title="Mental model" tone="info">
          Anonymous tunnels work without an account (URL only). Sign in when you need
          the inspector, replay, workspaces, or API keys. Anonymous traffic never
          appears in the dashboard.
        </DocsCallout>
        <DocsH2>A → Z checklist</DocsH2>
        <DocsSteps
          steps={[
            {
              title: "Install the CLI",
              body: "Use Node.js 20+ and install from GitHub Packages (PAT with read:packages required).",
              code: `npm install -g @hridhin-k/badger-cli
badger --version`,
            },
            {
              title: "Start your local app",
              body: "Whatever you want to expose must already listen on a port (for example 3000 or 8081).",
            },
            {
              title: "Open a tunnel",
              body: "Point Badger at that port. Copy the public URL it prints.",
              code: `badger 3000`,
            },
            {
              title: "Hit the public URL",
              body: "Browser, curl, webhook provider, or mobile client — any HTTP client works.",
              code: `curl https://<your-public-host>/`,
            },
            {
              title: "Sign in for the dashboard",
              body: (
                <>
                  Run <code className="text-mist">badger login</code> or open{" "}
                  <Link href="/login" className="text-pure-white underline-offset-2 hover:underline">
                    /login
                  </Link>
                  . Complete OAuth (Google by default) or email/password.
                </>
              ),
            },
            {
              title: "Confirm workspace",
              body: "After login the CLI may offer a workspace picker. The dashboard top bar shows the active workspace.",
              code: `badger workspace list
badger workspace use <name>`,
            },
            {
              title: "Re-open the tunnel while signed in",
              body: "Signed-in tunnels attach to your workspace so traffic is captured.",
              code: `badger 3000`,
            },
            {
              title: "Open Overview",
              body: (
                <>
                  Go to{" "}
                  <Link href="/overview" className="text-pure-white underline-offset-2 hover:underline">
                    Overview
                  </Link>
                  . Live events should stream when the WebSocket shows Live.
                </>
              ),
            },
            {
              title: "Inspect and replay",
              body: (
                <>
                  Open{" "}
                  <Link href="/requests" className="text-pure-white underline-offset-2 hover:underline">
                    Requests
                  </Link>
                  , expand a card, open details, and replay through the live tunnel.
                </>
              ),
            },
          ]}
        />
      </>
    ),
  },
  {
    slug: "installation",
    title: "Installation",
    description: "CLI install, monorepo local stack, and environment variables.",
    order: 2,
    section: "start",
    body: (
      <>
        <DocsH2>Production CLI (GitHub Packages)</DocsH2>
        <DocsP>
          Packages publish under <code className="text-mist">@hridhin-k/*</code> on
          GitHub Packages. Auth is required even for public packages.
        </DocsP>
        <DocsCode>{`# ~/.npmrc
@hridhin-k:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_PAT

npm install -g @hridhin-k/badger-cli
badger 3000`}</DocsCode>
        <DocsH2>Local monorepo (developers)</DocsH2>
        <DocsSteps
          steps={[
            {
              title: "Install and build",
              body: "From the repository root.",
              code: `pnpm install
pnpm build`,
            },
            {
              title: "Start the server",
              body: "Listens on 0.0.0.0:8080 by default. Do not use pnpm server (pnpm built-in).",
              code: `pnpm start:server`,
            },
            {
              title: "Start the dashboard",
              body: "Point NEXT_PUBLIC_BADGER_API_URL at the local server.",
              code: `# apps/dashboard/.env.local
NEXT_PUBLIC_BADGER_API_URL=http://localhost:8080

pnpm dashboard`,
            },
            {
              title: "Tunnel against local server",
              body: "Always pass --server when developing against localhost.",
              code: `pnpm cli -- 3000 --server ws://127.0.0.1:8080
# or
badger 3000 --server ws://127.0.0.1:8080`,
            },
          ]}
        />
        <DocsH2>Useful environment variables</DocsH2>
        <DocsUl
          items={[
            <><code className="text-mist">BADGER_SERVER_URL</code> — default WebSocket URL for the CLI</>,
            <><code className="text-mist">NEXT_PUBLIC_BADGER_API_URL</code> — dashboard REST + WS base</>,
            <><code className="text-mist">BADGER_CLI_ANIMATIONS=0</code> — disable CLI animations</>,
            <><code className="text-mist">NO_COLOR</code> — disable ANSI colors</>,
          ]}
        />
      </>
    ),
  },
  {
    slug: "authentication",
    title: "Authentication",
    description: "OAuth, API keys, sessions, and what requires sign-in.",
    order: 3,
    section: "start",
    body: (
      <>
        <DocsH2>Browser OAuth (developers)</DocsH2>
        <DocsCode>{`badger login
badger whoami
badger logout`}</DocsCode>
        <DocsP>
          Sessions are stored under <code className="text-mist">~/.config/badger/auth.json</code>{" "}
          with mode 0600. Access tokens refresh automatically before tunnel connect.
        </DocsP>
        <DocsH2>API keys (CI)</DocsH2>
        <DocsP>
          Create a workspace API key in the dashboard Workspace settings, then:
        </DocsP>
        <DocsCode>{`badger login --token bgk_…`}</DocsCode>
        <DocsCallout title="Security" tone="warn">
          Keys are hashed server-side. Treat the secret like a password. Rotate from
          Workspace if leaked. Key login does not grant a refreshable user JWT.
        </DocsCallout>
        <DocsH2>Dashboard auth</DocsH2>
        <DocsUl
          items={[
            <>Sign in at /login (Google OAuth and/or email password).</>,
            <>Password reset via /forgot-password and /auth/reset-password.</>,
            <>Account page covers verification, sessions snapshot, and delete.</>,
          ]}
        />
      </>
    ),
  },
  {
    slug: "cli",
    title: "CLI reference",
    description: "Commands, menus, flags, and local vs hosted server.",
    order: 4,
    section: "start",
    body: (
      <>
        <DocsH2>Interactive menu</DocsH2>
        <DocsP>
          Run <code className="text-mist">badger</code> with no args for the Lumen-styled
          menu: Create Tunnel, Login, Workspace, Dashboard, Config, Status, Help.
        </DocsP>
        <DocsH2>Core commands</DocsH2>
        <DocsCode>{`badger <port>                 # open tunnel
badger <port> -w <name>       # force workspace
badger <port> --server ws://127.0.0.1:8080

badger login | logout | whoami
badger workspace list | use <name>
badger replay <requestId>
badger status
badger config
badger help`}</DocsCode>
        <DocsH2>Hosted vs local</DocsH2>
        <DocsUl
          items={[
            <>Default server is the hosted Badger relay (production).</>,
            <>Always pass --server (or BADGER_SERVER_URL) for monorepo local stacks.</>,
            <>Dashboard API URL must match the same server the CLI uses.</>,
          ]}
        />
      </>
    ),
  },
  {
    slug: "tunnels",
    title: "Tunnels",
    description: "Public URLs, live sessions, anonymous mode, and the Tunnels page.",
    order: 5,
    section: "product",
    body: (
      <>
        <DocsH2>What a tunnel is</DocsH2>
        <DocsP>
          A tunnel is a live CLI session that forwards public HTTPS requests to a local
          port. The dashboard Tunnels page lists sessions observed over the live
          WebSocket for the active workspace.
        </DocsP>
        <DocsSteps
          steps={[
            {
              title: "Start local service",
              body: "Ensure the port accepts HTTP.",
            },
            {
              title: "Create tunnel",
              body: "From CLI menu or badger <port>.",
              code: `badger 3000`,
            },
            {
              title: "Share the public URL",
              body: "Paste into webhook consoles, mobile devices, or teammates.",
            },
            {
              title: "Watch Tunnels + Overview",
              body: (
                <>
                  Open{" "}
                  <Link href="/tunnels" className="text-pure-white underline-offset-2 hover:underline">
                    Tunnels
                  </Link>{" "}
                  for live sessions and Overview for request activity.
                </>
              ),
            },
            {
              title: "Stop",
              body: "Ctrl+C in the CLI. The session disappears from the live list.",
            },
          ]}
        />
        <DocsCallout title="Anonymous mode" tone="warn">
          Without login you still get a public URL, but no dashboard capture, replay,
          history, or teams. Features available: public tunnel, HTTPS, QR.
        </DocsCallout>
      </>
    ),
  },
  {
    slug: "overview",
    title: "Overview",
    description: "Live Activity Center — what is happening right now.",
    order: 6,
    section: "product",
    body: (
      <>
        <DocsP>
          Overview answers “what is happening right now?” with tunnel status, a live
          activity feed, and empty-state guidance when there is no traffic.
        </DocsP>
        <DocsUl
          items={[
            <>Connection pill must show Live for streaming updates.</>,
            <>New requests slide into the feed; completions update the same card.</>,
            <>Use Inspect / Replay actions on each event when a response exists.</>,
            <>Jump to full explorer via Requests.</>,
          ]}
        />
      </>
    ),
  },
  {
    slug: "requests",
    title: "Request explorer",
    description: "Search, filter, keyboard shortcuts, and detail pages.",
    order: 7,
    section: "product",
    body: (
      <>
        <DocsH2>Explorer</DocsH2>
        <DocsUl
          items={[
            <>Full-text search across URL, headers, method, bodies, status, tunnel.</>,
            <>Filter by method, status class, and tunnel.</>,
            <>Expandable timeline cards grouped by day.</>,
            <>Selected row uses ember hush + coral edge (Lumen selection).</>,
          ]}
        />
        <DocsH2>Keyboard</DocsH2>
        <DocsCode>{`/     focus search
j / ↓ next request
k / ↑ previous request
x / e expand or collapse
o     open details
⌘K    command palette`}</DocsCode>
        <DocsH2>Details</DocsH2>
        <DocsP>
          Detail pages include journey (Browser → Tunnel → Badger → Application →
          Response → Complete), waterfall timing, grouped headers, bodies, and replay.
        </DocsP>
      </>
    ),
  },
  {
    slug: "replay",
    title: "Replay",
    description: "Re-send a captured request through the live tunnel.",
    order: 8,
    section: "product",
    body: (
      <>
        <DocsSteps
          steps={[
            {
              title: "Keep a tunnel connected",
              body: "Replay requires an active forward path for that workspace.",
            },
            {
              title: "Pick a completed request",
              body: "Pending in-flight events cannot replay until a response is recorded.",
            },
            {
              title: "Replay from UI or CLI",
              body: "Use the Replay button on cards/details, ⌘K → type replay, or:",
              code: `badger replay <requestId> --server ws://127.0.0.1:8080`,
            },
            {
              title: "Read the replay response",
              body: "Status, latency, headers, and body appear in the replay panel.",
            },
          ]}
        />
      </>
    ),
  },
  {
    slug: "statistics",
    title: "Statistics",
    description: "Insight-first metrics and supporting charts.",
    order: 9,
    section: "product",
    body: (
      <>
        <DocsP>
          Statistics leads with insights (most active endpoint, slowest path, error
          rate, traffic trend, top tunnels) and keeps charts as supporting evidence.
        </DocsP>
        <DocsCallout title="Retention" tone="info">
          Traffic history is currently memory-backed on the server. Restarts clear
          recorded exchanges. Design for live debugging sessions, not long-term archives.
        </DocsCallout>
      </>
    ),
  },
  {
    slug: "command-palette",
    title: "Command palette",
    description: "⌘K navigation, search, workspace switch, and replay.",
    order: 10,
    section: "product",
    body: (
      <>
        <DocsP>
          Press <code className="text-mist">⌘K</code> (Ctrl+K on Windows/Linux) or use
          the top-nav Search control.
        </DocsP>
        <DocsUl
          items={[
            <>Navigate to Overview, Requests, Statistics, Tunnels, Workspace, Account, Docs.</>,
            <>Search requests (debounced inspector API) and open details.</>,
            <>Type replay to re-send recent requests.</>,
            <>Switch workspace memberships.</>,
            <>Recent searches persist locally.</>,
          ]}
        />
      </>
    ),
  },
  {
    slug: "workspaces",
    title: "Workspaces",
    description: "Personal vs shared, invites, members, and switching.",
    order: 11,
    section: "collaborate",
    body: (
      <>
        <DocsH2>Concepts</DocsH2>
        <DocsUl
          items={[
            <>Personal workspace — created at first sign-in for you alone.</>,
            <>Shared workspace — invite members with roles.</>,
            <>Active workspace scopes tunnels, traffic, keys, and invites.</>,
          ]}
        />
        <DocsH2>In the dashboard</DocsH2>
        <DocsP>
          Open Workspace for overview cards, invite flow, member management, secret
          reveal (copy once), and settings tabs. Use the top-bar switcher anytime.
        </DocsP>
        <DocsH2>In the CLI</DocsH2>
        <DocsCode>{`badger workspace
badger workspace list
badger workspace use acme
badger 3000 -w acme`}</DocsCode>
      </>
    ),
  },
  {
    slug: "api-keys",
    title: "API keys",
    description: "CI authentication without browser OAuth.",
    order: 12,
    section: "collaborate",
    body: (
      <>
        <DocsSteps
          steps={[
            {
              title: "Open Workspace settings",
              body: "Create a key, copy the secret immediately (shown once).",
            },
            {
              title: "Authenticate CI",
              body: "Store the secret in your CI vault.",
              code: `badger login --token bgk_…`,
            },
            {
              title: "Open tunnels in pipelines",
              body: "Same as local — badger <port> after key login.",
            },
            {
              title: "Rotate or revoke",
              body: "Use Workspace confirm actions when a key is compromised.",
            },
          ]}
        />
      </>
    ),
  },
  {
    slug: "account",
    title: "Account & security",
    description: "Identity, verification, sessions, and danger zone.",
    order: 13,
    section: "collaborate",
    body: (
      <>
        <DocsUl
          items={[
            <>Identity — profile fields from auth provider.</>,
            <>Security / verification — email verification flows.</>,
            <>Sessions — client view of token expiry and live socket status.</>,
            <>Workspace summary — memberships and active role.</>,
            <>Danger zone — sign out and account deletion (irreversible).</>,
          ]}
        />
      </>
    ),
  },
  {
    slug: "webhooks",
    title: "Webhook debugging",
    description: "End-to-end loop for provider webhooks through a Badger tunnel.",
    order: 14,
    section: "product",
    body: (
      <>
        <DocsCallout title="Why tunnels" tone="info">
          Providers need a public HTTPS URL. Badger gives you one that forwards to
          localhost, and captures every exchange for inspection and replay.
        </DocsCallout>
        <DocsH2>A → Z webhook loop</DocsH2>
        <DocsSteps
          steps={[
            {
              title: "Run your local handler",
              body: "Example: Express/FastAPI/Next route listening on port 3000.",
            },
            {
              title: "Open a signed-in tunnel",
              body: "So traffic is retained in the workspace inspector.",
              code: `badger login
badger 3000`,
            },
            {
              title: "Register the public URL",
              body: "Paste the HTTPS URL into Stripe, GitHub, Twilio, etc. Include any path your handler expects.",
            },
            {
              title: "Trigger an event",
              body: "Use the provider’s “send test event” or perform a real action in sandbox.",
            },
            {
              title: "Inspect in Requests",
              body: (
                <>
                  Open{" "}
                  <Link href="/requests" className="text-pure-white underline-offset-2 hover:underline">
                    /requests
                  </Link>
                  . Filter by path or status. Open the exchange for headers and body.
                </>
              ),
            },
            {
              title: "Fix and replay",
              body: "Adjust local code, keep the tunnel up, then Replay from the detail page without re-firing the provider.",
            },
          ]}
        />
        <DocsH3>Tips</DocsH3>
        <DocsUl
          items={[
            <>Keep the CLI process running for the whole debug session.</>,
            <>Signature verification often needs the raw body — check truncation flags.</>,
            <>Use a shared workspace when multiple engineers debug the same integration.</>,
          ]}
        />
      </>
    ),
  },
  {
    slug: "production-checklist",
    title: "Production checklist",
    description: "Hardening for a self-hosted or cloud Badger deployment.",
    order: 15,
    section: "reference",
    body: (
      <>
        <DocsH2>Before go-live</DocsH2>
        <DocsSteps
          steps={[
            {
              title: "TLS and public hostname",
              body: "Terminate TLS at your edge. Point DNS at the Badger server / proxy.",
            },
            {
              title: "Environment variables",
              body: "Set auth secrets, OAuth client IDs, allowed origins, and database URLs. Never commit secrets.",
            },
            {
              title: "Dashboard API URL",
              body: "NEXT_PUBLIC_BADGER_API_URL must be the publicly reachable API origin clients and browsers use.",
            },
            {
              title: "CORS / cookie domain",
              body: "Align dashboard origin with auth cookie and WebSocket allowed origins.",
            },
            {
              title: "Retention and storage",
              body: "Confirm inspector retention matches your compliance needs.",
            },
            {
              title: "Smoke test",
              body: "Login → tunnel → curl public URL → see request in Overview → replay once.",
            },
          ]}
        />
        <DocsCallout title="Anonymous vs authenticated" tone="warn">
          Anonymous tunnels are fine for quick demos. Production debugging should use signed-in
          workspaces so traffic is attributable and retained.
        </DocsCallout>
      </>
    ),
  },
  {
    slug: "troubleshooting",
    title: "Troubleshooting",
    description: "Common failures and how to fix them.",
    order: 16,
    section: "reference",
    body: (
      <>
        <DocsH3>No traffic in the dashboard</DocsH3>
        <DocsUl
          items={[
            <>Are you signed in on both CLI and dashboard?</>,
            <>Same workspace selected in both?</>,
            <>CLI --server matching NEXT_PUBLIC_BADGER_API_URL?</>,
            <>Anonymous tunnels never appear in the dashboard.</>,
          ]}
        />
        <DocsH3>WebSocket not Live</DocsH3>
        <DocsUl
          items={[
            <>Check the connection banner → Reconnect.</>,
            <>Confirm API URL and CORS / allowed origins in production.</>,
            <>Refresh auth (logout / login) if the token expired mid-session.</>,
          ]}
        />
        <DocsH3>Replay failed</DocsH3>
        <DocsUl
          items={[
            <>Tunnel must still be connected.</>,
            <>Request must have a recorded response (not pending).</>,
            <>Body may have been truncated — check flags on the detail page.</>,
          ]}
        />
        <DocsH3>CLI install auth errors</DocsH3>
        <DocsP>
          GitHub Packages needs a PAT with read:packages in ~/.npmrc. Without it,
          npm install -g @hridhin-k/badger-cli fails.
        </DocsP>
      </>
    ),
  },
  {
    slug: "glossary",
    title: "Glossary A–Z",
    description: "Alphabetized terms for Badger concepts.",
    order: 17,
    section: "reference",
    body: (
      <>
        <GlossaryList
          entries={[
            ["Anonymous mode", "Tunnel without login — public URL only, no inspector."],
            ["API key", "Workspace-scoped secret (bgk_…) for CI login."],
            ["Command palette", "⌘K launcher for navigate, search, replay, switch workspace."],
            ["Dashboard", "Next.js app for inspect / stats / workspace / account."],
            ["Explorer", "Requests timeline with search, filters, and keyboard nav."],
            ["Inspector", "Capture of HTTP exchanges for a workspace."],
            ["Journey", "Visual hop list from browser to complete response."],
            ["Live feed", "Overview stream of recent events over WebSocket."],
            ["Membership", "User role binding to a workspace."],
            ["Personal workspace", "Default private workspace for a user."],
            ["Public URL", "HTTPS endpoint printed by the CLI for a tunnel."],
            ["Replay", "Re-send a captured request through the live tunnel."],
            ["Shared workspace", "Collaborative workspace with invites and keys."],
            ["Statistics", "Aggregates and insight cards for retained traffic."],
            ["Tunnel", "Live CLI forward path from public URL to local port."],
            ["Waterfall", "Timing visualization on request details."],
            ["WebSocket", "Dashboard live channel (/dashboard/ws) for events."],
            ["Workspace", "Primary tenancy unit — scopes traffic and secrets."],
          ]}
        />
      </>
    ),
  },
];

function GlossaryList({
  entries,
}: {
  readonly entries: readonly (readonly [string, string])[];
}) {
  return (
    <dl className="mt-6 divide-y divide-slate/80 rounded-lg bg-ink shadow-hairline">
      {entries.map(([term, def]) => (
        <div key={term} className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
          <dt className="font-mono text-[12px] tracking-[0.04em] text-coral-pulse uppercase">
            {term}
          </dt>
          <dd className="text-sm leading-relaxed text-smoke">{def}</dd>
        </div>
      ))}
    </dl>
  );
}

export function getDocsArticle(slug: string): DocsArticle | undefined {
  return DOCS_ARTICLES.find((article) => article.slug === slug);
}

export function listDocsArticles(): readonly DocsArticle[] {
  return [...DOCS_ARTICLES].sort((a, b) => a.order - b.order);
}
