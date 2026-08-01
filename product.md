# Badger — Product Specification

**Status:** Current product as implemented in this repository  
**Source of truth:** Code + shipped docs (not plans or assumptions)  
**Repository:** https://github.com/Hridhin-k/looplink  
**License:** MIT  

This document describes what Badger is and does **right now**. Incomplete surfaces and known gaps are listed under [Limitations](#14-limitations).

---

## 1. What is Badger?

**Badger** is an open-source platform for **local HTTP observability**.

It helps developers **inspect, replay, measure, and collaborate around** the HTTP traffic that hits a local service — while that service is reachable through a secure public URL.

The public URL is the **transport**.  
The product is **visibility**: capture, search, live updates, statistics, replay, and workspace-scoped collaboration.

> **Ship tunnels. Inspect everything.**  
> Start with a public URL. Sign in when you need capture, replay, and shared workspaces.

| | |
| --- | --- |
| **Display name** | Badger (`APP_DISPLAY_NAME`) |
| **App id** | `badger` (`APP_NAME`) |
| **Who it’s for** | Individual developers, freelancers, and teams debugging local APIs, webhooks, and integrations |
| **Primary domain model** | **Workspace** (not organizations) |

> Rebranded from **LoopLink**. The `looplink` CLI binary remains a **deprecated alias**. Prefer `badger` and `BADGER_*` environment variables.

### Phase status

| Phase | Scope | Status |
| --- | --- | --- |
| **1** | Tunnel engine (transport) | **Production ready** — stable; extend, do not redesign |
| **2** | Observability (inspector, live WS, replay) | **Production ready** — stable; extend, do not redesign |
| **3** | Multi-tenant SaaS (auth, workspaces, API keys, anonymous sessions) | **In development** — core surfaces shipped; docs and polish catching up |

---

## 2. Why Badger?

Traditional tunnel tools stop after giving you a public URL.

Badger continues after the URL exists:

- **Inspect** every forwarded HTTP exchange — method, path, headers, bodies, status, latency
- **Search and filter** traffic in a live dashboard
- **Replay** a captured request through the active tunnel
- **Observe** request rate, latency (avg / P95), error rate, and method/status breakdowns
- **Collaborate** in workspaces with roles, invitations, and API keys for CI
- **Debug locally** with the same traffic your webhook or mobile client is sending

```text
Without Badger              With Badger
─────────────────           ──────────────────────────────
Public URL                  Public URL
     │                           │
     ▼                           ▼
Local app                   Local app
                                 │
                                 ▼
                            Captured traffic
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
                Inspector     Replay      Statistics
                    │
                    ▼
               Workspace dashboard
```

---

## 3. Core capabilities

Skimmable product surface — details follow in later sections.

### Tunneling (transport)

- Public HTTPS URLs for a local TCP port
- Path-mode and subdomain-mode URL shapes
- Anonymous sessions (`bga_…`) for quick share links
- Authenticated workspace tunnels (JWT or `bgk_…` API key)
- Heartbeat, reconnect, and orphan reclaim

### Observability

- Automatic recording of forwarded HTTP exchanges
- Workspace-scoped inspector (list, search, detail)
- Live dashboard updates over WebSocket
- Server-computed statistics (RPM, latency, errors, histograms)
- Replay from dashboard or CLI

### Collaboration

- Personal workspace for every authenticated user
- Shared workspaces with roles (`owner` / `admin` / `developer` / `viewer`)
- Invitations and member management
- Workspace API keys for CI/CD
- Server-side membership resolution (clients are not trusted for authz)

### Dashboard

- Marketing landing + auth flows
- Overview, requests explorer, request detail, statistics
- Workspace settings (members, invites, keys)
- Account management

---

## 4. Feature overview

| Capability | Description | Status | Use case |
| --- | --- | --- | --- |
| Public URL tunnel | Relay public HTTP → `localhost:{port}` | Production | Webhooks, mobile clients, demos |
| Anonymous tunnel | Tunnel without an account (`bga_…`) | Production | Quick share; no inspector |
| Authenticated tunnel | JWT / API key + workspace scope | Production | Team / personal observability |
| Request capture | Auto-record forwarded exchanges | Production | Debug what actually arrived |
| Inspector | Searchable request list + detail | Production | Find failing calls, inspect bodies |
| Live updates | `/dashboard/ws` fan-out | Production | Watch traffic as it happens |
| Replay | Re-send a recorded request via the live tunnel | Production | Reproduce bugs without the client |
| Statistics | RPM, avg/P95 latency, error %, histograms | Production | Spot regressions while developing |
| Workspaces | Personal + shared; roles; invites | Shipped (Phase 3) | Isolate projects / teams |
| API keys | `bgk_…` keys, hashed at rest | Shipped (Phase 3) | CI tunnels without browser OAuth |
| CLI auth | Browser OAuth + key login | Shipped (Phase 3) | `badger login` / `badger login --token` |
| End-user WebSockets over tunnel | App WS upgrades (e.g. HMR) | **Not supported** | Use localhost for HMR |
| Durable traffic store | Survive server restart | **Not implemented** | Memory only today |

---

## 5. Product journey

```text
Developer
    │
    ▼
CLI  (badger login / anonymous session)
    │
    ▼
Secure tunnel  (WebSocket control plane + HTTP frames)
    │
    ▼
Public URL  ←── external HTTP clients
    │
    ▼
Local app  (localhost:{port})
    │
    ▼
Traffic recorder  (event-driven; does not alter forwarding)
    │
    ├──────────────┬──────────────┐
    ▼              ▼              ▼
Inspector       Statistics      Replay
    │
    ▼
Dashboard  (live WebSocket + REST)
    │
    ▼
Workspace  (members, invites, API keys)
```

---

## 6. Operating modes

### Anonymous tunnel

Fast public URL. No account required. Observability stays off.

```text
badger 3000
    │
    ▼
POST /api/v1/anonymous-sessions  →  bga_…
    │
    ▼
WebSocket upgrade  (X-Anonymous-Session)
    │
    ▼
Permission: tunnel:create only
    │
    ▼
https://{slug}.{BADGER_PUBLIC_BASE_DOMAIN}
  or  https://{base}/tunnel/{tunnelId}
```

**Not available anonymously:** dashboard inspector, replay history, workspaces, API keys, team collaboration.

### Authenticated workspace

Sign in once; tunnels and traffic stay inside a workspace.

```text
badger login          # browser OAuth (Google by default)
    │                 # or: badger login --token bgk_…
    ▼
Session → ~/.config/badger/auth.json
    │
    ▼
badger workspace use Personal
badger 3000 -w Personal
    │
    ▼
Authorization: Bearer <JWT|bgk_…>
X-Workspace-Id: <optional>
    │
    ▼
Tunnel + inspector + live dashboard  (workspace-scoped)
```

> **Note:** CLI and dashboard sessions are **separate**.  
> CLI stores credentials in `~/.config/badger/auth.json`.  
> Dashboard uses browser `localStorage` key `badger.auth.session`.  
> Logging into one does not log into the other.

### Admission rule

Bare WebSocket connect with **no** credentials is **rejected** (`Authentication required.`).

A connection must present one of:

| Credential | Header / form |
| --- | --- |
| Supabase JWT | `Authorization: Bearer <token>` |
| Workspace API key | `Authorization: Bearer bgk_…` |
| Anonymous session | `X-Anonymous-Session: bga_…` |

> **Warning:** Some older README wording still says unauthenticated connect is allowed. **Code requires** JWT, API key, or anonymous session.

---

## 7. User flow

What works end-to-end today:

1. **Server** runs (Railway in production, or locally on port `8080`).
2. **CLI** authenticates (login or anonymous session) and opens a WebSocket tunnel for a local TCP port.
3. Server mints a **public URL** (path mode or subdomain mode).
4. External **HTTP** traffic to that URL is forwarded through the CLI to `http://localhost:{port}`.
5. For **authenticated** workspaces, every forwarded exchange is recorded in **process memory** and exposed via inspector REST + dashboard live WebSocket.
6. **Dashboard** (Cloudflare Worker) provides landing, auth, overview, requests, statistics, workspace, and account against the same server API.

```text
External client
      │  GET https://….tunnel…/api/hooks
      ▼
Badger server  ──frames──▶  CLI  ──HTTP──▶  localhost:3000
      │
      └──(authenticated)──▶  EventBus → TrafficRecorder → Inspector / Dashboard
```

---

## 8. Components

| Component | Package | Version | Publishable | Role |
| --- | --- | --- | --- | --- |
| CLI | `@hridhin-k/badger-cli` | `1.3.0` | Yes (GitHub Packages) | Login, tunnels, workspaces, replay |
| Server | `@hridhin-k/badger-server` | `0.0.2` | No (`private`) | Tunnel + auth/workspace APIs + inspector + live WS |
| Dashboard | `@hridhin-k/badger-dashboard` | `0.1.2` | No (`private`) | Next.js UI over REST + WebSocket only |
| Shared | `@hridhin-k/badger-shared` | `1.3.0` | Yes (GitHub Packages) | Protocol types, EventBus, storage, traffic, stats, live client |
| E2E | `@hridhin-k/badger-e2e` | `0.0.0` | No (`private`) | Black-box tests; never published |

**Design rules:**

- Apps under `apps/` are deployable; they are never imported by other workspaces.
- Dependency graph: `cli → shared ← server`.
- Dashboard talks **only** to the server’s public REST and WebSocket APIs — no server imports, no direct Supabase from React.
- Layer 1 tunnel protocol and HTTP frame forwarding are **frozen**.
- Phase 2 observes via EventBus without changing that protocol.
- **Workspace** is the multi-tenant boundary. Organizations are not first-class.

**Runtime:** Node.js `>= 20`, pnpm `>= 9`.

---

## 9. Architecture

```text
CLI / Dashboard browser
        │
        ▼
 NestJS + Fastify + ws  (apps/server)   ← single port (default 8080)
        │
        ├── TunnelGateway `/`          (CLI control plane)
        ├── DashboardGateway `/dashboard/ws`
        ├── HTTP forward `/tunnel/*` + Host mode
        ├── REST `/api/v1/*`           (auth, workspaces, inspector, anonymous-sessions)
        │
        ├── Context Engine             (JWT / API key / anonymous → TunnelContext)
        │
        ├── Repositories / services
        │     • Memory: live tunnels, traffic StorageProvider
        │     • Supabase (optional): auth, workspaces, members, invites,
        │       API keys, accounts, audit, anonymous_sessions, tunnel ownership mirror
        │
        └── EventBus (in-process) → TrafficRecorder → Memory storage
              → StatisticsNotifier → Dashboard WS fan-out
```

**Optional SaaS backend:** Supabase (Auth + Postgres).  
If `SUPABASE_*` is unset, Phases 1–2 memory paths and in-memory anonymous sessions can still run; durable SaaS features need Supabase.

---

## 10. CLI

**Binaries:** `badger`, `looplink` (alias → same entrypoint; prints a deprecation warning).

### Install

```bash
# GitHub Packages auth required (even for public packages)
npm install -g @hridhin-k/badger-cli
badger login
badger 3000
```

Also: `npx @hridhin-k/badger-cli 3000`.

### Example — open a tunnel

```text
$ badger 3000

✔ Connected to Badger server.

  Workspace  Personal
  Local      http://localhost:3000
  Public     https://{slug}.{BADGER_PUBLIC_BASE_DOMAIN}

✔ Public URL copied to clipboard
Press Ctrl+C to stop
```

### Example — authenticate and select workspace

```bash
badger login
badger whoami
badger workspace list
badger workspace use Personal
badger 3000 -w Personal
```

### Example — CI with an API key

```bash
badger login --token bgk_…
badger 3000
```

### Example — replay a captured request

```bash
badger replay <requestId>
# → method/path → status, tunnel id, optional truncation warning, body text
```

`badger replay` calls `POST {httpBase}/api/v1/traffic/:requestId/replay` (legacy path; preferred inspector path also exists on the server).

### Commands

| Command | What it does |
| --- | --- |
| `badger [port]` | Opens a tunnel; omit port for interactive menu |
| `badger login` | Browser OAuth (Google by default) |
| `badger login --token <bgk_…>` | Authenticate with a workspace API key (CI/CD) |
| `badger logout` | Clear local session |
| `badger whoami` | Print current authenticated user |
| `badger status` | Session / config status |
| `badger workspace` / `list` / `use` | Inspect and select active workspace |
| `badger config` | Local preferences (QR, copy URL, server/dashboard URLs, animations, …) |
| `badger replay <requestId>` | Replay a recorded HTTP request through the live tunnel |
| `badger help` | Help |
| `--version` / `--help` | Standard Commander help/version |
| `-s` / `--server` | Override server WebSocket URL |
| `-w` / `--workspace` | Workspace id or name (requires authenticated session) |

### Server URL resolution

Precedence:

1. `--server` / `-s`
2. `BADGER_SERVER_URL`
3. `LOOPLINK_SERVER_URL` (deprecated)
4. Default: `wss://looplinkserver-production.up.railway.app`

Local: `badger 3000 --server ws://127.0.0.1:8080`.

### CLI UX

- Progress / interactive prompts on stderr; primary output on stdout.
- On ready: workspace label, local ↔ public URL, clipboard copy, optional QR (stdout TTY only).
- Anonymous mode prints a notice that inspector/dashboard features require sign-in.
- Reconnect messaging while recovering a session.

---

## 11. Server

**Stack:** NestJS + Fastify + `ws` on a **single TCP port** (default host `0.0.0.0`, default port `8080`). HTTP and WebSocket share that listener.

### 11.1 Public tunnel (Layer 1)

Every forwarded request is relayed as chunked HTTP frames over the CLI control-plane WebSocket. The local app sees a normal HTTP request to `localhost`.

| Capability | Details |
| --- | --- |
| CLI control plane | WebSocket at `/` (auth or anonymous required) |
| Path-mode tunnels | `ALL /tunnel/*` → `/tunnel/{tunnelId}/…` |
| Host/subdomain tunnels | Catch-all Host-based forwarding |
| Health | `GET /health` → `{ status: "ok" }` |
| Heartbeat | CLI ping every **30s**; server idle timeout **60s** |
| Reconnect reclaim | Orphan reclaim window **10m** (`TUNNEL_RECLAIM_WINDOW_MS = 600_000`); CLI reconnect interval **5s** |
| Forward timeout | `BADGER_HTTP_FORWARD_TIMEOUT_MS` (default **30000**) |
| Live tunnel map | **In-memory** (`MemoryTunnelRepository`) |
| Ownership mirror | Best-effort Supabase `tunnels` rows when SaaS is enabled (not used for routing) |

**Public URL modes** (`BADGER_PUBLIC_URL_MODE`, default **`path`**):

| Mode | URL shape |
| --- | --- |
| `path` | `https://{BADGER_PUBLIC_BASE_DOMAIN}/tunnel/{tunnelId}` |
| `subdomain` | `https://{16-hex-slug}.{BADGER_PUBLIC_BASE_DOMAIN}` |

- Default base domain if unset: `badger.dev`.
- Deprecated aliases: `LOOPLINK_PUBLIC_BASE_DOMAIN`, `LOOPLINK_PUBLIC_URL_MODE` (`BADGER_*` wins when both set).
- Tunnel id entropy: 16 random bytes (hex); public subdomain slug length: 16 hex chars.

**Reserved management paths** (not forwarded as app traffic): `/api/v1`, `/api/v1/*`, `/api/docs`, `/api/docs/*`.  
Application paths such as `/api/data` **are forwarded**.

> **Warning:** The data plane forwards **HTTP request/response frames only**. End-user WebSocket upgrades (for example Next.js `/_next/webpack-hmr`) are **not** supported through the public URL. Use localhost for HMR; prefer a production/static build when demoing over a tunnel.

#### Tunnel protocol messages (CLI ↔ server)

Wire `MessageType` values:

`connected`, `create_tunnel`, `tunnel_created`, `error`, `ping`, `pong`,  
`http_request_start`, `http_request_chunk`, `http_request_end`,  
`http_response_start`, `http_response_chunk`, `http_response_end`,  
`http_cancel`

### 11.2 Auth & account APIs (Phase 3)

| Area | Endpoints / behavior |
| --- | --- |
| Session | login, refresh, logout |
| OAuth | start + callback (CLI browser flow; dashboard Google) |
| Password | forgot / reset |
| Email | verify / resend |
| Profile | `GET /api/v1/me` |
| Account | `DELETE /api/v1/auth/account` |
| Anonymous | `POST /api/v1/anonymous-sessions` → `bga_…` |

Tokens: Supabase JWTs (Bearer) and workspace API keys (`bgk_…`, hashed at rest).  
Optional HttpOnly cookie mode exists server-side for credentialed browser sessions; the default dashboard SPA uses Bearer tokens in `localStorage`.

There is **no** dedicated dashboard signup page — users are created via OAuth or Supabase-managed email flows.

### 11.3 Workspaces & collaboration

Identity model: **Account → Membership → Workspace** (no Organizations).

| Capability | Details |
| --- | --- |
| Personal workspace | Auto-created for every auth user |
| Shared workspaces | Create, list, update, soft-delete, leave, transfer ownership |
| Roles | `owner` \| `admin` \| `developer` \| `viewer` with a permission matrix |
| Invitations | Create invite; token returned once |
| Members | List, change role, remove |
| API keys | Create, list, rotate, revoke (`bgk_…`) |
| Audit | Best-effort `audit_events` when Supabase is enabled |

Workspace membership is resolved **server-side**. Clients must not be trusted for authorization based on workspace ids alone.

### 11.4 Context Engine

`ContextResolver` / `ContextFactory` produce a `TunnelContext` for JWT, API-key, or anonymous callers and hide credential details from business services.  
HTTP inspector/replay routes use `@UseGuards(JwtAuthGuard, ContextAuthGuard)` (and related permission checks).

### 11.5 Inspector & observability APIs

Every forwarded request (in an authenticated workspace) is automatically captured and becomes searchable in the dashboard and inspector API.

**Auth required:** JWT or API key + workspace context for inspector, preferred replay, and dashboard live WS.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/inspector/requests` | List recorded traffic (`tunnelId`, `limit`, `q`) — workspace-scoped |
| `GET` | `/api/v1/inspector/request/:id` | Request detail including bodies |
| `POST` | `/api/v1/inspector/replay/:id` | Replay (preferred path) |
| `GET` | `/api/v1/inspector/statistics` | Aggregates (`tunnelId` optional) |
| `POST` | `/api/v1/traffic/:requestId/replay` | Legacy replay path (still present) |
| — | `/api/docs` | Swagger UI |

**Example — list recent requests**

```http
GET /api/v1/inspector/requests?limit=20
Authorization: Bearer <access_token>
X-Workspace-Id: <workspace_uuid>
```

**Example — replay**

```http
POST /api/v1/inspector/replay/{requestId}
Authorization: Bearer <access_token>
```

**Dashboard live WebSocket:** `/dashboard/ws`  
Requires auth; workspace-scoped fan-out.  
Message types include: connected, ping/pong, tunnel_connected / tunnel_disconnected, request_received, response_completed, replay_completed, statistics_updated. Server ping interval: **30s**.

**CORS:** `/api/*` only. Empty `BADGER_ALLOWED_ORIGINS` = permissive (reflect request Origin). Methods: GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS.

### 11.6 Traffic recording

Every forwarded HTTP exchange is observed via the EventBus and stored for inspection — **without changing** Layer 1 forwarding.

- `TrafficRecorder` subscribes to EventBus and persists via `StorageProvider`.
- Does **not** intercept Layer 1 forwarding.
- Retention: **1000** records (oldest evicted).
- Recorded body cap: **64 KiB** per side (`DEFAULT_MAX_RECORDED_BODY_BYTES`); original byte length still tracked when truncated.
- Storage namespace: `traffic`.
- Full-text search fields include URL, headers, method, body, response, tunnel, status, timestamp.
- Records are associated with workspace context when authenticated.

**HTTP EventBus publications wired from forwarding:**  
`RequestReceived`, `RequestForwarded`, `ResponseReturned`, `RequestFailed`.  
Replay publishes `ReplayCompleted`. Statistics path publishes `StatisticsUpdated`.

### 11.7 Statistics

Server-computed aggregates: total requests, requests per minute (60s window), average latency, P95 latency, error rate, method counts, status-code counts, top endpoints (default 10), per-tunnel breakdown.

### 11.8 Storage

- **Only implemented traffic backend:** in-memory (`MemoryStorage`).
- Wired as `createStorageProvider({ backend: "memory" })` in `StorageModule`.
- Reserved backends that throw if selected: `sqlite`, `postgres`, `redis`, `s3`.
- Provider API: `save` / `get` / `list` / `delete` / `clear` by namespace.
- Supabase Postgres holds **SaaS** state (accounts, workspaces, keys, anonymous sessions, audit, tunnel ownership mirror) — not the inspector traffic store.

> **Note:** Restarting or redeploying the server clears inspector history and in-memory tunnel state. Multi-replica fan-out is not supported.

### 11.9 EventBus event types

`TunnelCreated`, `TunnelClosed`, `ClientConnected`, `ClientDisconnected`,  
`RequestReceived`, `RequestForwarded`, `ResponseReturned`, `RequestFailed`,  
`ReconnectStarted`, `ReconnectSucceeded`, `ReplayCompleted`, `StatisticsUpdated`

> **Known gap:** Tunnel lifecycle events are defined and consumed by the dashboard gateway path, but not all Layer 1 tunnel-manager exits fully emit them yet. The HTTP request path **is** wired.

---

## 12. Dashboard

**Stack:** Next.js **16.2.12**, React **19**, TanStack Query/Table, Recharts, Zustand, Tailwind 4, OpenNext Cloudflare adapter.

### Routes

| Route | Auth | What it does |
| --- | --- | --- |
| `/` | Public | Marketing landing |
| `/login` | Public | Google OAuth + email/password |
| `/forgot-password` | Public | Password reset request |
| `/auth/callback` | Public | OAuth / auth callback |
| `/auth/reset-password` | Public | Password reset completion |
| `/overview` | Required | KPIs + recent traffic |
| `/requests` | Required | Request explorer |
| `/requests/[id]` | Required | Detail, estimated timeline, headers/query/cookies/body, replay |
| `/statistics` | Required | KPIs + charts |
| `/workspace` | Required | Members, invites, API keys, settings |
| `/account` | Required | Identity, email verification, account delete |

Authenticated product routes use `RequireAuth` and live `/dashboard/ws` (workspace-scoped).

### Requests explorer

- Fetches inspector list (default limit **1000**).
- Search (debounced **300ms**), method / status / tunnel filters, sort, pagination (**page size 25**).
- Live updates via `/dashboard/ws`.
- Detail view: method, status, id, path, tunnel, timestamp, latency, error; request/response tabs; replay action.
- Timeline phases are **estimated** from total `latencyMs` (not measured phase timestamps).

### Statistics view

- KPIs: requests/min, average latency, P95, error %.
- Charts: requests over time, latency over time, status distribution, methods, tunnel activity.
- Time series are **derived client-side** from up to 1000 request summaries (not a server time-series API).

### Environment

| Variable | Role | Default if unset |
| --- | --- | --- |
| `NEXT_PUBLIC_BADGER_API_URL` | Badger server HTTP origin (baked at **build** time for production) | `http://localhost:8080` |
| `NEXT_PUBLIC_BADGER_WS_URL` | Optional WebSocket override | Derived from API origin → `/dashboard/ws` |

---

## 13. Deployment

### Tunnel server — Railway

- Config: `railway.json` (Docker builder, healthcheck `GET /health`, 1 replica, restart on failure).
- Documented required vars include: `BADGER_PUBLIC_BASE_DOMAIN`, `BADGER_PUBLIC_URL_MODE`, `PORT`, `HOST=0.0.0.0`, plus Supabase vars for SaaS.
- Default CLI target in code: `wss://looplinkserver-production.up.railway.app`.
- Documented public tunnel hostname pattern: `*.tunnel.wybrand.in` / `tunnel.wybrand.in` (when `BADGER_PUBLIC_BASE_DOMAIN` is set that way).

### Dashboard — Cloudflare Workers (OpenNext)

- Worker name in `wrangler.jsonc`: **`looplink`**.
- Git-connected Workers Builds from `Hridhin-k/looplink` on `main`.
- Build: `@hridhin-k/badger-shared` then `opennextjs-cloudflare build`.
- Deploy: `opennextjs-cloudflare deploy`.
- Custom domain `dashboard.wybrand.in` is **documented as intended**; Wrangler `routes` custom-domain block is **commented out** until the zone exists.
- Interim URL: `looplink.<account-subdomain>.workers.dev` (example used in testing: `https://looplink.hridhinchembakasseri.workers.dev`).

### Docker (server)

- Multi-stage `Dockerfile` (development/production targets).
- Compose: `docker-compose.yml` + `docker-compose.dev.yml` / `docker-compose.prod.yml`.
- Optional nginx TLS edge for wildcard subdomains (`docker/nginx/`).
- Same port **8080** for HTTP + CLI WebSocket.

### Packaging & release

- **Changesets** (`pnpm changeset`, `version-packages`, `release`).
- GitHub Actions `.github/workflows/release.yml` on `main`.
- **Published packages only:** `@hridhin-k/badger-shared`, `@hridhin-k/badger-cli`.
- Registry: `https://npm.pkg.github.com` (scope `@hridhin-k`).

### Testing

| Suite | Notes |
| --- | --- |
| `@hridhin-k/badger-shared` | Vitest unit tests |
| `@hridhin-k/badger-server` | Vitest unit tests |
| `@hridhin-k/badger-cli` | Vitest unit tests |
| `@hridhin-k/badger-e2e` | Black-box e2e (public URL, headers, cookies, binary, streaming, heartbeat, reconnect, path/host modes) |

Phase 2 report baseline (2026-07-28): shared 68, server 96, cli 43, e2e 16 (**223** total). Counts may have grown with Phase 3 — run `pnpm test` / `pnpm test:e2e` for current numbers.

Dashboard has lint/build scripts; it is **not** included in root `pnpm test`.

---

## 14. Security

### AuthN / AuthZ

| Surface | Behavior |
| --- | --- |
| Tunnel WS `/` | Requires JWT, API key, or anonymous session |
| Inspector / replay / dashboard WS | JWT or API key + workspace context |
| Workspace membership | Resolved server-side; never trust client-supplied workspace ids alone |
| API keys | `bgk_…`; stored hashed; public prefix for display |
| Anonymous tokens | `bga_…`; `tunnel:create` only |

### Limits (defaults)

| Setting | Env | Default |
| --- | --- | --- |
| Allowed browser origins | `BADGER_ALLOWED_ORIGINS` | empty → allow all |
| Max HTTP body (public) | `BADGER_MAX_HTTP_BODY_BYTES` | 5 MiB |
| Max WS message | `BADGER_MAX_WS_MESSAGE_BYTES` | 256 KiB |
| Max WS connections | `BADGER_MAX_WS_CONNECTIONS` | 1000 |
| Max WS connections / IP | `BADGER_MAX_WS_CONNECTIONS_PER_IP` | 50 |
| WS message rate | `BADGER_WS_MESSAGE_RATE_LIMIT` / `_WINDOW_MS` | 120 / 60s (control-plane; HTTP response frames excluded) |
| HTTP rate / IP | `BADGER_HTTP_RATE_LIMIT_MAX` / `_WINDOW_MS` | 2000 / 60s |
| HTTP request timeout | `BADGER_HTTP_REQUEST_TIMEOUT_MS` | 30000 |
| Max pending HTTP exchanges | (constant) | 500 |
| Max buffered response bytes / exchange | (constant) | 10 MiB |

### CORS

Applied to `/api/*` only. Empty `BADGER_ALLOWED_ORIGINS` reflects the request Origin (permissive). Cookie auth mode requires an explicit allow-list.

---

## 15. Limitations

Explicit current gaps — not roadmap claims:

| Item | Current state |
| --- | --- |
| Durable traffic history | Memory only; cleared on process restart |
| Postgres / SQLite / Redis / S3 **traffic** storage | Reserved in factory; **not implemented** |
| Multi-instance / horizontal scale | Not supported (in-memory bus + storage + tunnel map) |
| End-user WebSocket / TCP over public tunnel | Not supported (HTTP frames only; Upgrade stripped) |
| Organizations as first-class entity | Out of model — workspaces only |
| Tunnels management page / list API | No dedicated product UI |
| Dashboard signup page | None (OAuth / Supabase-managed users) |
| Server time-series statistics API | Charts bucket client-side from retained list |
| Measured request timeline phases | Estimated from total latency |
| Full tunnel lifecycle EventBus emission | Partially missing from tunnel manager |
| Custom domain `dashboard.wybrand.in` on Worker | Intended; Wrangler custom-domain route currently commented out |
| Anonymous → inspector/dashboard | Unavailable by design |
| Supabase `tunnels` rows | Ownership mirror only; routing stays in memory |
| Phase 3 documentation completeness | Early phase docs exist; later workspace/API-key/anonymous docs lag code |
| `looplink` CLI name | Deprecated alias |
| README “unauthenticated WS still allowed” | **Stale** — code requires JWT, API key, or anonymous session |

---

## 16. Related docs

| Doc | Topic | Notes |
| --- | --- | --- |
| `README.md` | Overview, scripts, install, auth | Auth section useful; unauthenticated-WS note is stale |
| `COMMANDS.md` | Local/prod/deploy cheatsheet | Weak on login/workspace CLI — see README |
| `docs/migration.md` | LoopLink → Badger | |
| `docs/railway.md` | Server on Railway | |
| `docs/cloudflare-dashboard.md` | Dashboard on Cloudflare | |
| `docs/storage.md` | Storage abstraction | |
| `docs/event-bus.md` | EventBus | |
| `docs/traffic-recorder.md` | TrafficRecorder | |
| `docs/phase-2-architecture.md` | Phase 2 design | Still valid for observability stack |
| `docs/phase-3-infrastructure.md` | Phase 3.1 foundation | |
| `docs/phase-3-authentication.md` | Early Phase 3.2 auth | Partially stale vs later workspace/CLI work |
| `docs/publishing.md` | Package publish | |
| `PHASE2_REPORT.md` | Phase 2 verification + limitations | Auth limitation #7 obsolete for authenticated paths |
| `e2e/README.md` | E2E harness | |
| `.cursor/rules/project.mdc` | Phase status + engineering constraints | Authoritative for Phase 3 intent |

---

*Product specification derived from repository state. Phases 1–2 are production ready; Phase 3 multi-tenant SaaS is in active development. Where older docs disagree with code, this file follows the code.*
