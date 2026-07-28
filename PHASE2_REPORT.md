# Phase 2 Verification Report — Badger

**Date:** 2026-07-28  
**Scope:** Observability platform layer (EventBus → TrafficRecorder → Inspector REST/WS → Dashboard) on top of frozen Layer 1 tunnel transport  
**Verdict:** **PASS** (after one verified routing fix)

---

## Architecture summary

Phase 2 adds a side-car observability stack that **observes** Layer 1 exits via a typed `EventBus`. It does not alter the CLI ↔ server WebSocket tunnel protocol or the HTTP frame forwarding sequence.

```text
Public HTTP / Host|path routing
        │
        ▼
HttpForwardingService  ──fire-and-forget──▶  EventBus
        │                                       │
        │ Layer 1 frames (unchanged)            ├──▶ TrafficRecorder → Memory Storage
        ▼                                       ├──▶ StatisticsNotifier → StatisticsUpdated
Tunnel CLI / local app                          └──▶ DashboardGateway → /dashboard/ws

Inspector REST  /api/v1/inspector/*
Replay          /api/v1/inspector/replay/:id  (+ legacy traffic replay path)
Dashboard       Next.js app (REST + WS only; never imports server source)
```

**Layer 1 rule (verified):** publishers call `EventBus.publish` after frames are sent / bodies are observed; publish never awaits subscribers; subscriber errors are isolated in `InMemoryEventBus`.

---

## Modules added

### `packages/shared`

| Area | Role |
| ---- | ---- |
| `event-bus/` | Typed bus (`publish` / `subscribe` / `unsubscribe` / `once` / `clear`), stamped payloads |
| `storage/` | `StorageProvider` + in-memory implementation |
| `traffic/` | `TrafficRecorder`, body caps, record store, full-text search |
| `statistics/` | Aggregate compute (RPM, avg/P95 latency, error rate, histograms) |
| `replay/` | Map stored records back to forward requests |
| `dashboard/` | Live message types, mappers, `DashboardLiveClient` (browser-safe) |

### `apps/server`

| Module | Role |
| ------ | ---- |
| `EventModule` | Global `EVENT_BUS` DI |
| `StorageModule` | Process-local storage provider |
| `TrafficModule` | Nest adapter for `TrafficRecorder` |
| `StatisticsModule` | Aggregate queries |
| `ReplayModule` | Replay through existing `HttpForwardingService` |
| `InspectorModule` | REST `/api/v1/inspector/*` + Swagger |
| `DashboardModule` | Live `/dashboard/ws` fan-out |
| `HttpForwardingService` (emit-only) | Publishes `RequestReceived` / `RequestForwarded` / `ResponseReturned` / `RequestFailed` |

### `apps/dashboard`

| Surface | Role |
| ------- | ---- |
| `/` | Overview shell |
| `/requests`, `/requests/[id]` | Explorer, detail, timeline, replay, search |
| `/statistics` | KPIs + Recharts (requests/latency over time, status, methods, tunnels) |
| Providers | TanStack Query, theme, `DashboardLiveClient` reconnect |

---

## Verification checklist

| Check | Result | Notes |
| ----- | ------ | ----- |
| TypeScript build (`pnpm build` / `tsc -b`) | **PASS** | Shared, server, CLI project references |
| ESLint (`pnpm lint`) | **PASS** | Fixed CORS helper + array-type lint findings |
| Prettier (`pnpm format:check`) | **PASS** | Added `.next/` to `.prettierignore`; formatted source |
| Unit tests (`pnpm test`) | **PASS** | shared 68, server 96, cli 43 (**207** total) |
| E2E tests (`pnpm test:e2e`) | **PASS** | 16/16 after routing fix |
| New tests | **PASS** | `http-forward.controller.spec.ts` (management-path reserve); Phase 2 suites already covered EventBus/traffic/dashboard/reconnect |
| Dashboard build | **PASS** | Next.js production build includes `/statistics` |
| Memory usage | **PASS** (spot) | Idle server RSS ≈ **58 MB** (`node ./dist/main.js` on :8080) |
| Event leaks | **PASS** (review) | Subscribers use `OnModuleDestroy` + `unsubscribe`; bus `clear()` available for tests |
| Listener cleanup | **PASS** (review + tests) | Dashboard provider removes `online`/`offline`, unsubscribes, `disconnect()`; live client clears reconnect timers |
| Replay performance | **PASS** (bench) | 100 in-process replays: avg **0.26 ms**, p50 **0.11 ms**, p95 **0.77 ms**, max **4.9 ms** (mock WS; excludes network RTT) |
| WebSocket reconnects | **PASS** | Unit: `DashboardLiveClient` reconnect + stale-close ignore; CLI reconnect integration; E2E server-restart reclaim |
| Dashboard responsiveness | **PASS** (spot) | Dev: `/` ~320 ms, `/requests` ~152 ms, `/statistics` ~312 ms (TTFB, coldish); inspector REST ~2 ms idle |

---

## Issue fixed during verification

### Host-based forwarder blocked application `/api/*` paths

**Symptom:** E2E `forwards JSON responses` and post-restart reconnect forward returned **404** for `/api/data`.

**Cause:** `HttpForwardController` treated **all** paths under `/api/` as management API and short-circuited with 404, colliding with legitimate app routes.

**Fix:** Reserve only `/api/v1` and `/api/docs` via `isReservedManagementPath()`. Covered by `http-forward.controller.spec.ts`.

**Also fixed (tooling):**

- `registerApiCors` made synchronous (eslint `require-await` / `await-thenable`)
- Spec array type `T[]` vs `Array<T>`
- `.prettierignore` excludes `.next/`

---

## Performance notes

| Area | Observation |
| ---- | ----------- |
| Forward path | Event publish is fire-and-forget; response body observation caps retained bytes at **64 KiB** (`DEFAULT_MAX_RECORDED_BODY_BYTES`) while still streaming full bodies to clients |
| Traffic store | Retention default **1000** records (oldest evicted) — bounds memory growth |
| Statistics | Recomputed asynchronously via `StatisticsNotifier` promise chain (prior failures do not block later publishes) |
| Dashboard charts | Time series derived client-side from up to 1000 request summaries (30-minute / 1-minute buckets) — not a server time-series API |
| Replay | Reuses `HttpForwardingService`; overhead dominated by tunnel RTT in production, not mapping/store lookup |
| Live WS | Dashboard ping every **30s**; client auto-reconnect; intentional disconnect cancels timers |

---

## Test summary

| Suite | Files | Tests | Status |
| ----- | ----- | ----- | ------ |
| `@hridhin-k/badger-shared` | 12 | 68 | Pass |
| `@hridhin-k/badger-server` | 19 | 96 | Pass |
| `@hridhin-k/badger-cli` | 8 | 43 | Pass |
| `@hridhin-k/badger-e2e` | 2 | 16 | Pass |
| **Total** | **41** | **223** | **Pass** |

Notable coverage for Phase 2 concerns:

- EventBus unsubscribe / once / clear / handler isolation
- TrafficRecorder integration (EventBus → store)
- Dashboard live client reconnect + stale close
- CLI WebSocket reclaim reconnect
- E2E tunnel forward + server restart reclaim
- New management-path reservation unit tests

---

## Known limitations

1. **No durable history** — traffic/statistics live in process memory; restart clears the inspector.
2. **No server time-series API** — charts bucket client-side from the retained request list window.
3. **Tunnel lifecycle events** (`TunnelCreated` / `TunnelClosed` / client connect) are defined and consumed by the dashboard gateway, but not all Layer 1 tunnel manager exits are fully emitting yet (HTTP request path is wired).
4. **Timeline phases** in the request detail UI are estimated from total `latencyMs` until measured phase timestamps exist.
5. **Dashboard overview** remains a placeholder; Requests + Statistics are the primary surfaces.
6. **Tunnels nav** still marked “Soon” (no dedicated tunnels management page).
7. **Auth** — inspector/replay/dashboard are intentionally unauthenticated (local-first / Phase 2 scope).
8. **Multi-instance** — in-memory EventBus/Storage do not fan out across replicas.

---

## Future extension points

| Extension | Hook |
| --------- | ---- |
| Persist traffic | Swap `StorageProvider` (SQLite / Postgres / Redis / S3) without changing recorder |
| Server time buckets | Extend `computeTrafficStatistics` / inspector DTO with interval series |
| Emit tunnel lifecycle | Publish from `TunnelManager` / gateway connect-disconnect exits |
| Measured timeline | Add phase timestamps on EventBus payloads; stop estimating in UI |
| AuthN/Z | Gate `/api/v1` + `/dashboard/ws` via `SecurityModule` |
| Distributed bus | Replace `InMemoryEventBus` behind `EVENT_BUS` token |
| AI / plugins | Subscribe to EventBus + traffic store; do not intercept `HttpForwardingService` |
| Overview / tunnels UI | Consume existing statistics + future tunnel list APIs |

---

## Commands used

```bash
pnpm build
pnpm lint
pnpm format            # then format:check
pnpm test
pnpm test:e2e
pnpm --filter @hridhin-k/badger-dashboard build
```

---

## Sign-off

Phase 2 platform modules build, lint, format, unit-test, and E2E-test cleanly after the `/api/*` reservation fix. Memory bounds, listener cleanup, reconnect behavior, replay overhead, and dashboard page responsiveness were spot-checked and are consistent with the architecture constraints (observe Layer 1; do not rewrite the tunnel protocol).
