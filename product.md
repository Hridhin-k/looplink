# Badger — Product Specification

**Status:** Current product as implemented in this repository  
**Source of truth:** Code + shipped docs (not plans or assumptions)  
**Repository:** https://github.com/Hridhin-k/looplink  
**License:** MIT  

This document describes what Badger is and does **right now**. Items that exist only as stubs, reserved backends, or disabled UI are listed under [Not implemented / limited](#not-implemented--limited).

---

## 1. What it is

**Badger** is an open-source developer tool that exposes a process running on localhost through a secure public URL. Traffic to that public URL is relayed to the developer’s machine over a WebSocket tunnel.

It is positioned as similar to ngrok: a public URL → local service tunnel.

> The product was rebranded from **LoopLink**. The `looplink` CLI binary remains as a **deprecated alias** for one release. Prefer `badger` and `BADGER_*` environment variables.

**Canonical display name:** Badger (`APP_DISPLAY_NAME`)  
**Canonical app id:** `badger` (`APP_NAME`)  
**Root package description:** “Expose localhost through secure public URLs.”

---

## 2. Product components

| Component | Package | Version (manifest) | Publishable | Role |
| --- | --- | --- | --- | --- |
| CLI | `@hridhin-k/badger-cli` | `1.2.0` | Yes (GitHub Packages) | Developer client; opens tunnel; optional replay |
| Server | `@hridhin-k/badger-server` | `0.0.1` | No (`private`) | Public tunnel server + inspector APIs + live WS |
| Dashboard | `@hridhin-k/badger-dashboard` | `0.1.1` | No (`private`) | Next.js UI over REST + WebSocket only |
| Shared library | `@hridhin-k/badger-shared` | `1.2.0` | Yes (GitHub Packages) | Protocol types, EventBus, storage, traffic, stats, dashboard live client |
| E2E suite | `@hridhin-k/badger-e2e` | `0.0.0` | No (`private`) | Black-box tests; never published |

**Architecture rules (enforced by design):**

- Apps under `apps/` are deployable; they are not imported by other workspaces.
- Dependency graph: `cli → shared ← server`.
- Dashboard communicates **only** through the server’s public REST and WebSocket APIs. It must not import server internals or share runtime state with the server.
- Layer 1 tunnel protocol and HTTP frame forwarding are treated as frozen; Phase 2 observability observes via EventBus without changing that protocol.

**Runtime prerequisites:** Node.js `>= 20`, pnpm `>= 9`.

---

## 3. End-to-end user flow (what works today)

1. **Server** runs (typically on Railway in production, or locally on port `8080`).
2. **CLI** connects to the server over WebSocket and requests a tunnel for a local TCP port.
3. Server mints a **public URL** (path mode or subdomain mode).
4. External HTTP traffic to that URL is forwarded through the CLI to `http://localhost:{port}`.
5. Forwarded exchanges are recorded in **process memory** and exposed via inspector REST + dashboard live WebSocket.
6. **Dashboard** (Cloudflare Worker) lists requests, shows detail/replay, and shows statistics against the same server API.

---

## 4. CLI features

**Binaries:** `badger`, `looplink` (alias → same entrypoint; `looplink` prints a deprecation warning).

**Install (documented):**

```bash
# GitHub Packages auth required (even for public packages)
npm install -g @hridhin-k/badger-cli
badger 3000
```

Also documented: `npx @hridhin-k/badger-cli 3000`.

### Commands

| Command | What it does |
| --- | --- |
| `badger <port>` | Opens a tunnel for the given local TCP port |
| `badger replay <requestId>` | Replays a recorded HTTP request through the live tunnel |
| `--version` / `--help` | Standard Commander help/version |

### Server URL resolution (start + replay)

Precedence:

1. `--server` / `-s`
2. `BADGER_SERVER_URL`
3. `LOOPLINK_SERVER_URL` (deprecated)
4. Default: `wss://looplinkserver-production.up.railway.app`

Local example: `badger 3000 --server ws://127.0.0.1:8080`.

### CLI UX (current behavior)

- Progress spinner on stderr; primary output on stdout.
- On ready: “Tunnel Created” or “Tunnel Restored”, forwarding line `publicUrl → http://localhost:{port}`, clipboard copy status, optional QR code (stdout TTY only), “Press Ctrl+C to stop”.
- Reconnect messaging while recovering a session.
- On stop: “Stopping Badger…”, “Tunnel closed. Goodbye.”
- Replay prints method/path → status, tunnel id, optional truncation warning, response body text.

`badger replay` calls `POST {httpBase}/api/v1/traffic/:requestId/replay` (legacy replay path).

---

## 5. Server features

**Stack:** NestJS + Fastify + `ws` on a **single TCP port** (default host `0.0.0.0`, default port `8080`). HTTP and WebSocket share that listener.

### 5.1 Public tunnel (Layer 1)

| Capability | Details |
| --- | --- |
| CLI control plane | WebSocket at `/` |
| Path-mode tunnels | `ALL /tunnel/*` → `/tunnel/{tunnelId}/…` |
| Host/subdomain tunnels | Catch-all Host-based forwarding |
| Health | `GET /health` → `{ status: "ok" }` |
| Heartbeat | CLI ping every **30s**; server idle timeout **60s** |
| Reconnect reclaim | Orphan reclaim window **60s** after disconnect; CLI reconnect interval **5s** |
| Forward timeout | `BADGER_HTTP_FORWARD_TIMEOUT_MS` (default **30000**) |

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

### 5.2 Tunnel protocol messages (CLI ↔ server)

Wire `MessageType` values:

`connected`, `create_tunnel`, `tunnel_created`, `error`, `ping`, `pong`,  
`http_request_start`, `http_request_chunk`, `http_request_end`,  
`http_response_start`, `http_response_chunk`, `http_response_end`,  
`http_cancel`

### 5.3 Inspector & observability APIs (Phase 2)

**Authentication:** none on inspector / replay / Swagger / dashboard WS (intentional current scope).

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/inspector/requests` | List recorded traffic (`tunnelId`, `limit`, `q`) |
| `GET` | `/api/v1/inspector/request/:id` | Request detail including bodies |
| `POST` | `/api/v1/inspector/replay/:id` | Replay (preferred path) |
| `GET` | `/api/v1/inspector/statistics` | Aggregates (`tunnelId` optional) |
| `POST` | `/api/v1/traffic/:requestId/replay` | Legacy replay path (still present) |
| — | `/api/docs` | Swagger UI |

**Dashboard live WebSocket:** `/dashboard/ws`  
Live message types include: connected, ping/pong, tunnel_connected / tunnel_disconnected, request_received, response_completed, replay_completed, statistics_updated. Server ping interval: **30s**.

**CORS:** applied to `/api/*` only. Empty `BADGER_ALLOWED_ORIGINS` = permissive (reflect request Origin). Methods: GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS.

### 5.4 Security / limits (defaults)

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

### 5.5 Traffic recording

- `TrafficRecorder` subscribes to EventBus and persists via `StorageProvider`.
- Does **not** intercept Layer 1 forwarding.
- Retention: **1000** records (oldest evicted).
- Recorded body cap: **64 KiB** per side (`DEFAULT_MAX_RECORDED_BODY_BYTES`); original byte length still tracked when truncated.
- Storage namespace: `traffic`.
- Full-text search fields include URL, headers, method, body, response, tunnel, status, timestamp.

**HTTP EventBus publications wired from forwarding:**  
`RequestReceived`, `RequestForwarded`, `ResponseReturned`, `RequestFailed`.  
Replay publishes `ReplayCompleted`. Statistics path publishes `StatisticsUpdated`.

### 5.6 Statistics (server-computed)

Available aggregates include: total requests, requests per minute (60s window), average latency, P95 latency, error rate, method counts, status-code counts, top endpoints (default 10), per-tunnel breakdown.

### 5.7 Storage

- **Only implemented backend:** in-memory (`MemoryStorage`).
- Wired as `createStorageProvider({ backend: "memory" })` in `StorageModule`.
- Reserved backends that throw if selected: `sqlite`, `postgres`, `redis`, `s3`.
- Provider API: `save` / `get` / `list` / `delete` / `clear` by namespace.

**Implication:** restarting or redeploying the server clears inspector history and in-memory tunnel state. Multi-replica fan-out is not supported.

### 5.8 EventBus event types (defined)

`TunnelCreated`, `TunnelClosed`, `ClientConnected`, `ClientDisconnected`,  
`RequestReceived`, `RequestForwarded`, `ResponseReturned`, `RequestFailed`,  
`ReconnectStarted`, `ReconnectSucceeded`, `ReplayCompleted`, `StatisticsUpdated`

**Known gap:** tunnel lifecycle events are defined and consumed by the dashboard gateway path, but not all Layer 1 tunnel-manager exits fully emit them yet. The HTTP request path **is** wired.

---

## 6. Dashboard features

**Stack:** Next.js **16.2.12**, React **19**, TanStack Query/Table, Recharts, OpenNext Cloudflare adapter.

### Pages / navigation

| Route | Status | What it does |
| --- | --- | --- |
| `/` | Placeholder | “Nothing to inspect yet” overview copy; not wired to APIs |
| `/requests` | Live | Request explorer |
| `/requests/[id]` | Live | Detail, estimated timeline, headers/query/cookies/body, replay |
| `/statistics` | Live | KPIs + charts |
| `/tunnels` | **Not implemented** | Nav item exists, **disabled**, label path marked Soon — no page |

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

## 7. Deployment (as configured)

### 7.1 Tunnel server — Railway

- Config: `railway.json` (Docker builder, healthcheck `GET /health`, 1 replica, restart on failure).
- Documented required vars include: `BADGER_PUBLIC_BASE_DOMAIN`, `BADGER_PUBLIC_URL_MODE` (path recommended on Railway), `PORT`, `HOST=0.0.0.0`.
- Default CLI target in code: `wss://looplinkserver-production.up.railway.app`.
- Documented public tunnel hostname pattern in ops docs: `*.tunnel.wybrand.in` / `tunnel.wybrand.in` (Railway + DNS), depending on how `BADGER_PUBLIC_BASE_DOMAIN` is set in that environment.

### 7.2 Dashboard — Cloudflare Workers (OpenNext)

- Worker name in `wrangler.jsonc`: **`looplink`**.
- Git-connected Workers Builds from `Hridhin-k/looplink` on `main`.
- Build command builds `@hridhin-k/badger-shared` then `opennextjs-cloudflare build`.
- Deploy command: `opennextjs-cloudflare deploy`.
- Custom domain `dashboard.wybrand.in` is **documented as intended**; the `routes` custom-domain block in `wrangler.jsonc` is **commented out** until the zone exists on the Cloudflare account.
- Interim URL shape: `looplink.<account-subdomain>.workers.dev` (example used in production testing: `https://58ea1baf-looplink.hridhinchembakasseri.workers.dev`).

### 7.3 Docker (server)

- Multi-stage `Dockerfile` with development/production targets.
- Compose overlays: `docker-compose.yml` + `docker-compose.dev.yml` / `docker-compose.prod.yml`.
- Optional nginx TLS edge config for wildcard subdomains (documented under `docker/nginx/`).
- Same port **8080** for HTTP + CLI WebSocket.

---

## 8. Packaging & release

- **Changesets** for versioning (`pnpm changeset`, `version-packages`, `release`).
- GitHub Actions `.github/workflows/release.yml` on `main`: opens/updates a release PR or publishes to GitHub Packages.
- **Published packages only:** `@hridhin-k/badger-shared`, `@hridhin-k/badger-cli`.
- Registry: `https://npm.pkg.github.com` (scope `@hridhin-k`).

---

## 9. Testing (current coverage)

| Suite | Tests (as of Phase 2 report) |
| --- | --- |
| `@hridhin-k/badger-shared` | 68 |
| `@hridhin-k/badger-server` | 96 |
| `@hridhin-k/badger-cli` | 43 |
| `@hridhin-k/badger-e2e` | 16 |
| **Total** | **223** |

E2E verifies (among other cases): public URL creation, JSON/HTML, headers, cookies, POST/query, binary (~150 KiB), streaming, heartbeat ping/pong, reconnect after server restart, path-mode URL minting/join/404, and Host-mode forwarding including app `/api/*` routes after the management-path fix.

Dashboard has lint/build scripts; it is **not** included in root `pnpm test`.

---

## 10. Not implemented / limited

These are explicit current gaps (code + Phase 2 report), not roadmap guesses:

| Item | Current state |
| --- | --- |
| Durable traffic history | Memory only; cleared on process restart |
| Postgres / Supabase / SQLite / Redis / S3 storage | Reserved in factory; **not implemented** |
| Dashboard Overview | Placeholder UI only |
| Tunnels management page / nav | Disabled “Soon”; no `/tunnels` route; no tunnels management REST API documented in inspector controller |
| AuthN/Z for inspector, replay, dashboard WS | None |
| Server time-series statistics API | Charts bucket client-side from retained list |
| Measured request timeline phases | Estimated from total latency |
| Full tunnel lifecycle EventBus emission | Partially missing from tunnel manager |
| Multi-instance / horizontal scale | Not supported (in-memory bus + storage + tunnel map) |
| Custom domain `dashboard.wybrand.in` on Worker | Intended; Wrangler custom-domain route currently commented out |
| `looplink` CLI name | Deprecated alias |

---

## 11. Feature summary (shipped)

**Tunneling**

- Expose local TCP port via hosted or self-hosted Badger server  
- Path-based and subdomain-based public URLs  
- Heartbeat, reconnect, orphan reclaim  
- Streaming HTTP forward (chunked protocol frames)  
- Binary payloads, headers, cookies, HTML/JSON (verified in e2e)

**Observability**

- Automatic recording of forwarded HTTP exchanges (capped retention/bodies)  
- Inspector REST: list, search/filter, detail, statistics, replay  
- Live dashboard WebSocket fan-out  
- CLI replay command  

**Dashboard UI**

- Requests explorer + detail + replay  
- Statistics KPIs and charts  
- Theme support in shell  
- Deployable to Cloudflare Workers via OpenNext  

**Ops**

- Railway Docker deploy for server  
- Cloudflare Workers Builds for dashboard  
- Local Docker Compose + optional nginx edge  
- Changesets + GitHub Packages for CLI/shared  

---

## 12. Related docs in-repo

| Doc | Topic |
| --- | --- |
| `README.md` | Overview, scripts, install |
| `docs/migration.md` | LoopLink → Badger |
| `docs/railway.md` | Server on Railway |
| `docs/cloudflare-dashboard.md` | Dashboard on Cloudflare |
| `docs/storage.md` | Storage abstraction |
| `docs/event-bus.md` | EventBus |
| `docs/traffic-recorder.md` | TrafficRecorder |
| `docs/phase-2-architecture.md` | Phase 2 design |
| `docs/publishing.md` | Package publish |
| `PHASE2_REPORT.md` | Verification results + known limitations |
| `e2e/README.md` | E2E harness |

---

*Generated from the repository state. If code and older docs disagree (for example EventBus “not wired” wording vs live HTTP publishers), this file follows the code and `PHASE2_REPORT.md`.*
