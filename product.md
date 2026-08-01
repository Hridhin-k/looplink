# Badger — Product Specification

**Status:** Current product as implemented in this repository  
**Source of truth:** Code + shipped docs (not plans or assumptions)  
**Repository:** https://github.com/Hridhin-k/looplink  
**License:** MIT  

This document describes what Badger is and does **right now**. Items that exist only as stubs, reserved backends, or incomplete surfaces are listed under [Not implemented / limited](#12-not-implemented--limited).

---

## 1. What it is

**Badger** is an open-source developer tool that exposes a process running on localhost through a secure public URL. Traffic to that public URL is relayed to the developer’s machine over a WebSocket control plane, with HTTP request/response forwarding.

It is positioned as similar to ngrok: a public URL → local service tunnel — plus request inspection, replay, and multi-user workspaces.

> The product was rebranded from **LoopLink**. The `looplink` CLI binary remains as a **deprecated alias**. Prefer `badger` and `BADGER_*` environment variables.

**Canonical display name:** Badger (`APP_DISPLAY_NAME`)  
**Canonical app id:** `badger` (`APP_NAME`)  
**Root package description:** “Expose localhost through secure public URLs.”  
**Landing pitch:** “Ship tunnels. Inspect everything.” — start anonymously for a public URL, then sign in for capture, replay, and workspace observability.

### Phase status

| Phase | Scope | Status |
| --- | --- | --- |
| **1** | Tunnel engine | **Production ready** |
| **2** | Developer observability (inspector, live WS, replay) | **Production ready** |
| **3** | Multi-tenant SaaS (auth, workspaces, API keys, anonymous sessions) | **In development** — core surfaces shipped; docs and polish still catching up |

Phase 1 and 2 subsystems are treated as **stable**: extend them; do not redesign them.

---

## 2. Product components

| Component | Package | Version (manifest) | Publishable | Role |
| --- | --- | --- | --- | --- |
| CLI | `@hridhin-k/badger-cli` | `1.3.0` | Yes (GitHub Packages) | Developer client; login; tunnels; workspaces; replay |
| Server | `@hridhin-k/badger-server` | `0.0.2` | No (`private`) | Tunnel server + auth/workspace APIs + inspector + live WS |
| Dashboard | `@hridhin-k/badger-dashboard` | `0.1.2` | No (`private`) | Next.js UI over REST + WebSocket only |
| Shared library | `@hridhin-k/badger-shared` | `1.3.0` | Yes (GitHub Packages) | Protocol types, EventBus, storage, traffic, stats, dashboard live client |
| E2E suite | `@hridhin-k/badger-e2e` | `0.0.0` | No (`private`) | Black-box tests; never published |

**Architecture rules (enforced by design):**

- Apps under `apps/` are deployable; they are not imported by other workspaces.
- Dependency graph: `cli → shared ← server`.
- Dashboard communicates **only** through the server’s public REST and WebSocket APIs. It must not import server internals, query Supabase directly, or share runtime state with the server.
- Layer 1 tunnel protocol and HTTP frame forwarding are frozen; Phase 2 observes via EventBus without changing that protocol.
- **Workspace** is the primary multi-tenant domain model. Organizations are not a first-class entity.

**Runtime prerequisites:** Node.js `>= 20`, pnpm `>= 9`.

---

## 3. Operating modes

### 3.1 Anonymous tunnel

1. CLI (or API) creates an anonymous session (`POST /api/v1/anonymous-sessions`) → token `bga_…`.
2. CLI connects to the tunnel WebSocket with `X-Anonymous-Session`.
3. Server admits a tunnel with **`tunnel:create` only**.
4. Public HTTP URL works as usual.

**Not available in anonymous mode:** dashboard inspector, replay history, workspaces, API keys, team collaboration.

### 3.2 Authenticated workspace

1. User signs in (CLI OAuth / API key, or dashboard Google / email-password).
2. Every authenticated user owns a **Personal Workspace** (created on auth user insert).
3. CLI attaches `Authorization: Bearer <JWT|bgk_…>` and optional `X-Workspace-Id`.
4. Tunnels, inspector traffic, and dashboard live updates are **workspace-scoped**.

CLI and dashboard hold **separate sessions** (CLI: `~/.config/badger/auth.json`; dashboard: browser `localStorage` key `badger.auth.session`). Logging into one does not log into the other.

### 3.3 Admission rule (tunnels)

Bare WebSocket connect with **no** credentials is **rejected** (`Authentication required.`).  
A connection must present a valid JWT, workspace API key (`bgk_…`), or anonymous session (`bga_…`).

> Some older README wording still says unauthenticated connect is allowed. **Code requires** JWT, API key, or anonymous session.

---

## 4. End-to-end user flow (what works today)

1. **Server** runs (Railway in production, or locally on port `8080`).
2. **CLI** authenticates (login or anonymous session) and connects over WebSocket for a local TCP port.
3. Server mints a **public URL** (path mode or subdomain mode).
4. External **HTTP** traffic to that URL is forwarded through the CLI to `http://localhost:{port}`.
5. For authenticated workspaces, forwarded exchanges are recorded in **process memory** and exposed via inspector REST + dashboard live WebSocket.
6. **Dashboard** (Cloudflare Worker) provides landing, auth, overview, requests, statistics, workspace, and account against the same server API.

---

## 5. CLI features

**Binaries:** `badger`, `looplink` (alias → same entrypoint; `looplink` prints a deprecation warning).

**Install (documented):**

```bash
# GitHub Packages auth required (even for public packages)
npm install -g @hridhin-k/badger-cli
badger login
badger 3000
```

Also documented: `npx @hridhin-k/badger-cli 3000`.

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
| `badger replay <requestId>` | Replays a recorded HTTP request through the live tunnel |
| `badger help` | Help |
| `--version` / `--help` | Standard Commander help/version |
| `-s` / `--server` | Override server WebSocket URL |
| `-w` / `--workspace` | Workspace id or name (requires authenticated session) |

### Server URL resolution (start + replay)

Precedence:

1. `--server` / `-s`
2. `BADGER_SERVER_URL`
3. `LOOPLINK_SERVER_URL` (deprecated)
4. Default: `wss://looplinkserver-production.up.railway.app`

Local example: `badger 3000 --server ws://127.0.0.1:8080`.

### CLI UX (current behavior)

- Progress / interactive prompts on stderr; primary output on stdout.
- On ready: workspace label, local ↔ public URL, clipboard copy status, optional QR code (stdout TTY only), “Press Ctrl+C to stop”.
- Anonymous mode prints a notice that inspector/dashboard features require sign-in.
- Reconnect messaging while recovering a session.
- Replay prints method/path → status, tunnel id, optional truncation warning, response body text.

`badger replay` calls `POST {httpBase}/api/v1/traffic/:requestId/replay` (legacy replay path; preferred inspector path also exists on the server).

---

## 6. Server features

**Stack:** NestJS + Fastify + `ws` on a **single TCP port** (default host `0.0.0.0`, default port `8080`). HTTP and WebSocket share that listener.

**Optional SaaS backend:** Supabase (Auth + Postgres). If `SUPABASE_*` is unset, Phases 1–2 memory paths and in-memory anonymous sessions can still run; durable SaaS features need Supabase.

### 6.1 Public tunnel (Layer 1)

| Capability | Details |
| --- | --- |
| CLI control plane | WebSocket at `/` (auth or anonymous required) |
| Path-mode tunnels | `ALL /tunnel/*` → `/tunnel/{tunnelId}/…` |
| Host/subdomain tunnels | Catch-all Host-based forwarding |
| Health | `GET /health` → `{ status: "ok" }` |
| Heartbeat | CLI ping every **30s**; server idle timeout **60s** |
| Reconnect reclaim | Orphan reclaim window **10m** after disconnect; CLI reconnect interval **5s** |
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

**Important limitation:** the data plane forwards **HTTP request/response frames only**. End-user WebSocket upgrades (for example Next.js `/_next/webpack-hmr`) are **not** supported through the public URL. Use localhost for HMR; prefer a production/static build when demoing over a tunnel.

### 6.2 Tunnel protocol messages (CLI ↔ server)

Wire `MessageType` values:

`connected`, `create_tunnel`, `tunnel_created`, `error`, `ping`, `pong`,  
`http_request_start`, `http_request_chunk`, `http_request_end`,  
`http_response_start`, `http_response_chunk`, `http_response_end`,  
`http_cancel`

### 6.3 Auth & account APIs (Phase 3)

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

### 6.4 Workspaces & collaboration

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

### 6.5 Context Engine

`ContextResolver` / `ContextFactory` produce a `TunnelContext` for JWT, API-key, or anonymous callers and hide credential details from business services.  
HTTP inspector/replay routes use `@UseGuards(JwtAuthGuard, ContextAuthGuard)` (and related permission checks).

### 6.6 Inspector & observability APIs (Phase 2 + auth)

**Authentication:** JWT or API key + workspace context required for inspector / preferred replay / dashboard live WS.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/inspector/requests` | List recorded traffic (`tunnelId`, `limit`, `q`) — workspace-scoped |
| `GET` | `/api/v1/inspector/request/:id` | Request detail including bodies |
| `POST` | `/api/v1/inspector/replay/:id` | Replay (preferred path) |
| `GET` | `/api/v1/inspector/statistics` | Aggregates (`tunnelId` optional) |
| `POST` | `/api/v1/traffic/:requestId/replay` | Legacy replay path (still present) |
| — | `/api/docs` | Swagger UI |

**Dashboard live WebSocket:** `/dashboard/ws`  
Requires auth; workspace-scoped fan-out.  
Live message types include: connected, ping/pong, tunnel_connected / tunnel_disconnected, request_received, response_completed, replay_completed, statistics_updated. Server ping interval: **30s**.

**CORS:** applied to `/api/*` only. Empty `BADGER_ALLOWED_ORIGINS` = permissive (reflect request Origin). Methods: GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS.

### 6.7 Security / limits (defaults)

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

### 6.8 Traffic recording

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

### 6.9 Statistics (server-computed)

Available aggregates include: total requests, requests per minute (60s window), average latency, P95 latency, error rate, method counts, status-code counts, top endpoints (default 10), per-tunnel breakdown.

### 6.10 Storage

- **Only implemented traffic backend:** in-memory (`MemoryStorage`).
- Wired as `createStorageProvider({ backend: "memory" })` in `StorageModule`.
- Reserved backends that throw if selected: `sqlite`, `postgres`, `redis`, `s3`.
- Provider API: `save` / `get` / `list` / `delete` / `clear` by namespace.
- Supabase Postgres holds **SaaS** state (accounts, workspaces, keys, anonymous sessions, audit, tunnel ownership mirror) — not the inspector traffic store.

**Implication:** restarting or redeploying the server clears inspector history and in-memory tunnel state. Multi-replica fan-out is not supported.

### 6.11 EventBus event types (defined)

`TunnelCreated`, `TunnelClosed`, `ClientConnected`, `ClientDisconnected`,  
`RequestReceived`, `RequestForwarded`, `ResponseReturned`, `RequestFailed`,  
`ReconnectStarted`, `ReconnectSucceeded`, `ReplayCompleted`, `StatisticsUpdated`

**Known gap:** tunnel lifecycle events are defined and consumed by the dashboard gateway path, but not all Layer 1 tunnel-manager exits fully emit them yet. The HTTP request path **is** wired.

---

## 7. Dashboard features

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

### Requests explorer (current)

- Fetches inspector list (default limit **1000**).
- Search (debounced **300ms**), method / status / tunnel filters, sort, pagination (**page size 25**).
- Live updates via `/dashboard/ws`.
- Detail view: method, status, id, path, tunnel, timestamp, latency, error; request/response tabs; replay action.
- Timeline phases are **estimated** from total `latencyMs` (not measured phase timestamps).

### Statistics view (current)

- KPIs: requests/min, average latency, P95, error %.
- Charts: requests over time, latency over time, status distribution, methods, tunnel activity.
- Time series are **derived client-side** from up to 1000 request summaries (not a server time-series API).

### Dashboard environment

| Variable | Role | Default if unset |
| --- | --- | --- |
| `NEXT_PUBLIC_BADGER_API_URL` | Badger server HTTP origin (baked at **build** time for production) | `http://localhost:8080` |
| `NEXT_PUBLIC_BADGER_WS_URL` | Optional WebSocket override | Derived from API origin → `/dashboard/ws` |

---

## 8. Architecture (as implemented)

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

---

## 9. Deployment (as configured)

### 9.1 Tunnel server — Railway

- Config: `railway.json` (Docker builder, healthcheck `GET /health`, 1 replica, restart on failure).
- Documented required vars include: `BADGER_PUBLIC_BASE_DOMAIN`, `BADGER_PUBLIC_URL_MODE`, `PORT`, `HOST=0.0.0.0`, plus Supabase vars for SaaS.
- Default CLI target in code: `wss://looplinkserver-production.up.railway.app`.
- Documented public tunnel hostname pattern in ops docs: `*.tunnel.wybrand.in` / `tunnel.wybrand.in` (Railway + DNS), depending on how `BADGER_PUBLIC_BASE_DOMAIN` is set.

### 9.2 Dashboard — Cloudflare Workers (OpenNext)

- Worker name in `wrangler.jsonc`: **`looplink`**.
- Git-connected Workers Builds from `Hridhin-k/looplink` on `main`.
- Build command builds `@hridhin-k/badger-shared` then `opennextjs-cloudflare build`.
- Deploy command: `opennextjs-cloudflare deploy`.
- Custom domain `dashboard.wybrand.in` is **documented as intended**; the `routes` custom-domain block in `wrangler.jsonc` is **commented out** until the zone exists on the Cloudflare account.
- Interim URL shape: `looplink.<account-subdomain>.workers.dev` (live example used in testing: `https://looplink.hridhinchembakasseri.workers.dev`).

### 9.3 Docker (server)

- Multi-stage `Dockerfile` with development/production targets.
- Compose overlays: `docker-compose.yml` + `docker-compose.dev.yml` / `docker-compose.prod.yml`.
- Optional nginx TLS edge config for wildcard subdomains (documented under `docker/nginx/`).
- Same port **8080** for HTTP + CLI WebSocket.

---

## 10. Packaging & release

- **Changesets** for versioning (`pnpm changeset`, `version-packages`, `release`).
- GitHub Actions `.github/workflows/release.yml` on `main`: opens/updates a release PR or publishes to GitHub Packages.
- **Published packages only:** `@hridhin-k/badger-shared`, `@hridhin-k/badger-cli`.
- Registry: `https://npm.pkg.github.com` (scope `@hridhin-k`).

---

## 11. Testing (current coverage)

| Suite | Notes |
| --- | --- |
| `@hridhin-k/badger-shared` | Vitest unit tests |
| `@hridhin-k/badger-server` | Vitest unit tests |
| `@hridhin-k/badger-cli` | Vitest unit tests |
| `@hridhin-k/badger-e2e` | Black-box e2e (public URL, headers, cookies, binary, streaming, heartbeat, reconnect, path/host modes) |

Phase 2 report baseline (2026-07-28): shared 68, server 96, cli 43, e2e 16 (**223** total). Counts may have grown with Phase 3 work — run `pnpm test` / `pnpm test:e2e` for current numbers.

Dashboard has lint/build scripts; it is **not** included in root `pnpm test`.

---

## 12. Not implemented / limited

These are explicit current gaps (code + docs), not roadmap guesses:

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

## 13. Feature summary (shipped)

**Tunneling**

- Expose local TCP port via hosted or self-hosted Badger server  
- Path-based and subdomain-based public URLs  
- Anonymous sessions (`bga_…`) and authenticated workspace tunnels  
- Heartbeat, reconnect, orphan reclaim  
- Streaming HTTP forward (chunked protocol frames)  
- Binary payloads, headers, cookies, HTML/JSON (verified in e2e)

**Observability**

- Automatic recording of forwarded HTTP exchanges (capped retention/bodies)  
- Workspace-scoped inspector REST: list, search/filter, detail, statistics, replay  
- Live dashboard WebSocket fan-out (authenticated)  
- CLI replay command  

**Multi-tenant SaaS (Phase 3, in progress)**

- Supabase Auth (OAuth + email/password) via Nest API  
- Personal + shared workspaces, roles, invites, members  
- Workspace API keys for CI/CD  
- Dashboard: landing, login, overview, requests, statistics, workspace, account  
- CLI: login / logout / whoami / status / workspace / config  

**Ops**

- Railway Docker deploy for server  
- Cloudflare Workers Builds for dashboard  
- Local Docker Compose + optional nginx edge  
- Changesets + GitHub Packages for CLI/shared  

---

## 14. Related docs in-repo

| Doc | Topic | Notes |
| --- | --- | --- |
| `README.md` | Overview, scripts, install, auth | Auth section is useful; unauthenticated-WS note is stale |
| `COMMANDS.md` | Local/prod/deploy cheatsheet | Weak on login/workspace CLI — see README for those |
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

*Updated from repository analysis (Phases 1–2 production; Phase 3 multi-tenant SaaS in active development). If code and older docs disagree, this file follows the code.*
