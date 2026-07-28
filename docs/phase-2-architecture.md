# Phase 2 Architecture — Badger Platform Layer

**Status:** Proposed — awaiting finalization before implementation  
**Date:** 2026-07-28  
**Prerequisite:** Layer 1 MVP (tunnel transport) is production-ready and frozen

This document defines how Phase 2 extends Badger into an observability + dashboard platform **without** rewriting Layer 1 networking, the tunnel protocol, or CLI forwarding behavior.

---

## 1. Layer 1 findings (analysis summary)

### 1.1 What Layer 1 is

Badger Layer 1 is a complete tunnel stack:

| Layer         | Components                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------ |
| Control plane | WebSocket JSON protocol (`connected`, `create_tunnel`, `tunnel_created`, `ping`/`pong`, `error`) |
| Data plane    | Chunked HTTP frames (`http_request_*`, `http_response_*`, `http_cancel`)                         |
| Server        | NestJS + Fastify: Gateway, TunnelManager, HttpForward, Security, Health                          |
| CLI           | WebSocket client, LocalProxy, RequestForwarder, Heartbeat, reconnect                             |
| Shared        | Protocol types + parsers in `@hridhin-k/badger-shared`                                           |

**Dependency graph (Layer 1):**

```text
apps/cli  ──imports──▶  packages/shared  ◀──imports──  apps/server
apps/dashboard          (no imports of server; scaffold only)
```

### 1.2 Forwarding pipeline (must remain unchanged)

```text
Public client
    │  HTTP
    ▼
PathTunnelController  OR  HttpForwardController
    │
    ▼
PublicRequestForwarder → HttpForwardingService
    │  WebSocket frames (HttpRequest*)
    ▼
TunnelGateway → CLI BadgerWebSocketClient
    │
    ▼
RequestForwarder → LocalProxy → localhost:{port}
    │  WebSocket frames (HttpResponse*)
    ▼
HttpExchangeCoordinator → Fastify reply → Public client
```

**Verified:** Protocol parsers, gateway frame routing, exchange coordination, and CLI local forward form a closed path. Phase 2 must not insert synchronous business logic into this path.

### 1.3 Tunnel protocol stability (verified)

Stable wire contract lives in:

- `packages/shared/src/types/protocol.ts`
- `packages/shared/src/types/http-forwarding.ts`
- `packages/shared/src/types/protocol-message.ts`
- `packages/shared/src/types/parse-protocol-message.ts`
- `packages/shared/src/types/parse-http-forwarding.ts`

Wire format: JSON text frames over WebSocket; discriminator `type` (string enum).  
**Phase 2 rule:** no new message types, no field renames, no semantic changes.

### 1.4 Existing EventBus (present but unwired)

`packages/shared/src/event-bus/` already defines:

- `EventBus` (`publish` / `subscribe` / `clear`)
- `InMemoryEventBus` + `createEventBus()`
- `EVENT_BUS` DI token (`Symbol.for("badger.EventBus")`)
- Typed `BadgerEventMap` (tunnel + request lifecycle)

**Gaps vs project rules:**

| Rule                           | Current state                                        |
| ------------------------------ | ---------------------------------------------------- |
| Export from package root       | **Not exported** from `packages/shared/src/index.ts` |
| Server wiring                  | **None** — `AppModule` has no EventModule            |
| Event `id` field               | **Missing** on payloads (rules require event id)     |
| Isolation of subscriber errors | Documented & implemented in InMemoryEventBus         |

Historical note: EventBus + TrafficRecorder were briefly integrated then removed (empty dirs `apps/server/src/events/`, `apps/server/src/traffic/` remain). Phase 2 reintroduces them cleanly as additive modules.

### 1.5 Public APIs today

| Surface                | Purpose                  | Dashboard-usable?         |
| ---------------------- | ------------------------ | ------------------------- |
| `GET /health`          | Liveness                 | Yes (health only)         |
| `ALL /tunnel/{id}/...` | Path-mode public traffic | No (end-user app traffic) |
| Host-based `ALL *`     | Subdomain public traffic | No                        |
| CLI WebSocket          | Tunnel protocol          | No (not a management API) |

**Conclusion:** Dashboard cannot be built on existing surfaces alone. Phase 2 must add versioned management APIs.

---

## 2. Modules that must never be modified

Treat as **frozen contracts**. Phase 2 may only _observe_ them (emit events beside calls) or _compose_ around them.

### Protocol (shared)

- `packages/shared/src/types/protocol.ts`
- `packages/shared/src/types/http-forwarding.ts`
- `packages/shared/src/types/protocol-message.ts`
- `packages/shared/src/types/parse-protocol-message.ts`
- `packages/shared/src/types/parse-http-forwarding.ts`
- Shared heartbeat / reconnect constants that define wire timing

### Server forwarding & lifecycle semantics

- `apps/server/src/gateway/tunnel.gateway.ts` — message routing / ownership
- `apps/server/src/http-forward/http-forwarding.service.ts`
- `apps/server/src/http-forward/http-exchange.coordinator.ts`
- `apps/server/src/http-forward/public-request-forwarder.ts`
- `apps/server/src/http-forward/request-mapper.ts`
- `apps/server/src/http-forward/path-tunnel.controller.ts` — path routing semantics
- `apps/server/src/http-forward/http-forward.controller.ts` — host routing semantics
- `apps/server/src/tunnel/tunnel.manager.ts` — create / reclaim / detach semantics
- `apps/server/src/tunnel/public-url.ts` — URL shapes
- `apps/server/src/tunnel/memory-tunnel.repository.ts` — reclaim window behavior (interface may gain observers later; behavior frozen)

### CLI forwarding

- `apps/cli/src/services/websocket-client.ts`
- `apps/cli/src/services/request-forwarder.ts`
- `apps/cli/src/services/local-proxy.ts`
- `apps/cli/src/services/start-tunnel.ts` (tunnel/reconnect behavior)
- CLI body-codec used on the wire

### Explicitly allowed

- New Nest modules imported by `AppModule`
- Thin emission wrappers / optional EventBus injections **beside** frozen call sites (preferred: extract emit helper used at existing return points without changing control flow)
- New `/api/v1/*` controllers
- New dashboard app code
- New packages under `packages/shared` (storage, traffic) or folders matching project layout
- Extending `BadgerEventMap` / payloads **additively** (new optional fields or new event names) without breaking existing event consumers once published

---

## 3. Extension points (Layer 1 → Phase 2)

| Extension point                     | Location                                      | How Phase 2 uses it                                                      |
| ----------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------ |
| Nest DI / modules                   | `AppModule.imports`                           | Add `EventModule`, `TrafficModule`, `ApiModule`                          |
| `TUNNEL_REPOSITORY`                 | `tunnel.constants.ts`                         | Optional: wrap or decorate for read APIs; keep Memory impl               |
| `EVENT_BUS` token                   | `packages/shared/.../tokens.ts`               | Global EventBus provider                                                 |
| Lifecycle method exits              | Gateway, TunnelManager, HttpForwardingService | Emit events after success/failure (fire-and-forget)                      |
| CLI presenter / reconnect callbacks | `StartTunnelService`                          | Optional: emit reconnect events on CLI side (server-first for dashboard) |
| Security module                     | `SecurityModule`                              | Apply rate limits / origin rules to `/api/v1` and dashboard WS           |
| Dashboard isolation                 | HTTP/WS only                                  | Never import `@hridhin-k/badger-server`                                  |

**Non-goals for hooks:** middleware that rewrites tunnel frames; subclassing `HttpForwardingService` to alter frame order; changing `parseProtocolMessage`.

---

## 4. Phase 2 scope

### In scope

1. **EventBus platform wiring** — export, Nest `EventModule`, typed emits at lifecycle points
2. **StorageProvider** — interface + in-memory implementation
3. **TrafficRecorder** — EventBus subscriber; stores request/response metadata (+ optional bodies with caps)
4. **Public management API** — REST `/api/v1/...` DTOs (tunnels, traffic, health detail)
5. **Dashboard live channel** — dedicated WebSocket (or SSE) for event fan-out to UI (**not** the CLI tunnel protocol)
6. **Dashboard UI** — Next.js app consuming only public APIs

### Out of scope (later phases)

- AI Engine / AI-assisted debugging
- Plugin SDK
- Replay engine (may share StorageProvider later)
- Multi-instance / external Redis-backed EventBus (interface allows future swap)
- Changing CLI UX beyond optional telemetry emissions

---

## 5. Target dependency graph

```text
                    ┌─────────────────────┐
                    │  apps/dashboard     │
                    │  (Next.js)          │
                    └──────────┬──────────┘
                               │ HTTPS + WS (management only)
                               │ never imports server source
                               ▼
┌──────────────┐      ┌────────────────────────────────────────┐
│  apps/cli    │ WS   │  apps/server                           │
│  (Layer 1)   │◄────►│  Gateway + HttpForward + Tunnel (L1)   │
└──────┬───────┘      │  + EventModule                         │
       │              │  + TrafficModule (subscriber)          │
       │              │  + ApiModule (/api/v1 + dash WS)       │
       │              └──────────┬─────────────────┬───────────┘
       │                         │                 │
       │                         │ DI              │ DI
       ▼                         ▼                 ▼
┌──────────────────────────────────────────────────────────────┐
│  packages/shared                                             │
│  types/ (protocol — FROZEN)                                  │
│  event-bus/                                                  │
│  storage/   (StorageProvider)          ← Phase 2             │
│  traffic/   (record types + ports)     ← Phase 2             │
│  utils/ constants/                                           │
└──────────────────────────────────────────────────────────────┘
```

**Rules:**

- `dashboard →` HTTP/WS public API only
- `cli → shared` only (no server)
- `server → shared` only among apps
- `traffic` depends on `event-bus` + `storage`, never on Nest controllers
- Circular dependencies forbidden

---

## 6. Module diagram

```text
┌──────────────── AppModule ────────────────┐
│                                           │
│  SecurityModule (existing)                │
│  HealthModule (existing)                  │
│  TunnelModule (existing — emit only)      │
│  HttpForwardModule (existing — emit only) │
│  GatewayModule (existing — emit only)     │
│                                           │
│  EventModule (@Global)          [NEW]     │
│    provides EVENT_BUS                     │
│                                           │
│  StorageModule                  [NEW]     │
│    provides STORAGE_PROVIDER              │
│                                           │
│  TrafficModule                  [NEW]     │
│    TrafficRecorderService                 │
│    TrafficRecordStore (port)              │
│    subscribes to EventBus on init         │
│                                           │
│  ApiModule                      [NEW]     │
│    /api/v1/tunnels                        │
│    /api/v1/traffic                        │
│    /api/v1/events/stream (WS or SSE)      │
│    DTOs only — no repository leakage      │
└───────────────────────────────────────────┘
```

---

## 7. Event flow

```text
CLI / Public HTTP
        │
        ▼
┌─────────────────── Layer 1 (unchanged control flow) ───────────────────┐
│ TunnelGateway / TunnelManager / HttpForwardingService                    │
│   … after successful or failed outcome …                                 │
│   eventBus.publish(Type, payload)   // fire-and-forget, never awaited    │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
                                    ▼
                          InMemoryEventBus
                     (isolate subscriber errors)
                                    │
                 ┌──────────────────┼──────────────────┐
                 ▼                  ▼                  ▼
         TrafficRecorder     ApiEventBridge      (future: AI)
         → StorageProvider   → Dashboard WS
```

### Canonical events (existing `BadgerEventMap`)

| Event                                     | Emitter (Phase 2)                        | Primary consumers                     |
| ----------------------------------------- | ---------------------------------------- | ------------------------------------- |
| `ClientConnected`                         | TunnelGateway                            | Dashboard live                        |
| `ClientDisconnected`                      | TunnelGateway                            | Dashboard live, Traffic (session end) |
| `TunnelCreated`                           | TunnelManager / Gateway after create     | Traffic, API list cache, Dashboard    |
| `TunnelClosed`                            | TunnelManager unregister / orphan expiry | same                                  |
| `RequestReceived`                         | HttpForwardingService entry              | Traffic                               |
| `RequestForwarded`                        | after frames sent to CLI                 | Traffic / metrics                     |
| `ResponseReturned`                        | after coordinator completes              | Traffic                               |
| `RequestFailed`                           | forward timeout / errors                 | Traffic                               |
| `ReconnectStarted` / `ReconnectSucceeded` | CLI optional; server on reclaim          | Dashboard                             |

### Event payload contract (Phase 2 alignment)

Every event payload must include (project rules):

- `eventId: string` (new additive field — UUID/ULID)
- `occurredAt: number` (already present)
- `tunnelId` when applicable (already present)
- `requestId` when applicable (already present)

**Migration of EventBus types:** additive fields only; bump shared package via Changesets.

### Isolation guarantee

`EventBus.publish` must never throw into Layer 1. Subscriber failures are logged and swallowed (already the InMemoryEventBus contract).

---

## 8. Folder structure (target)

```text
packages/shared/src/
  event-bus/          # EXISTS — re-export from index; add eventId to payloads
  storage/            # NEW
    storage-provider.ts
    memory-storage-provider.ts
    tokens.ts
    index.ts
  traffic/            # NEW — types + ports only (no Nest)
    traffic-record.ts
    traffic-record-store.ts
    index.ts
  types/              # FROZEN protocol
  constants/
  utils/

apps/server/src/
  events/             # NEW (replace empty dir)
    event.module.ts
  storage/            # NEW Nest binding
    storage.module.ts
  traffic/            # NEW (replace empty dir)
    traffic.module.ts
    traffic-recorder.service.ts
    memory-traffic-record.store.ts
  api/                # NEW
    api.module.ts
    v1/
      tunnels.controller.ts
      traffic.controller.ts
      dto/
      events.gateway.ts   # dashboard live channel (separate from tunnel WS)
  gateway/            # FROZEN behavior — emit only
  http-forward/       # FROZEN behavior — emit only
  tunnel/             # FROZEN behavior — emit only

apps/dashboard/src/
  app/                # Next App Router pages
  lib/
    api-client.ts     # REST client → BADGER_API_BASE_URL
    live-client.ts    # management WS/SSE
  components/
  hooks/
```

---

## 9. Interface boundaries

### 9.1 EventBus (shared)

```ts
interface EventBus {
  publish<T extends keyof BadgerEventMap>(type: T, payload: BadgerEventMap[T]): void;
  subscribe<T extends keyof BadgerEventMap>(
    type: T,
    handler: EventHandler<BadgerEventMap[T]>,
  ): EventSubscription;
  clear(): void;
}
```

### 9.2 StorageProvider (shared) — new

```ts
interface StorageProvider {
  get<T>(namespace: string, key: string): Promise<T | undefined>;
  set<T>(namespace: string, key: string, value: T): Promise<void>;
  delete(namespace: string, key: string): Promise<void>;
  listKeys(namespace: string, prefix?: string): Promise<string[]>;
  clearNamespace(namespace: string): Promise<void>;
}
```

First implementation: `MemoryStorageProvider`.  
Traffic store may either wrap `StorageProvider` or implement a dedicated port that _internally_ uses it — prefer dedicated `TrafficRecordStore` port for query ergonomics, backed by memory first.

### 9.3 TrafficRecordStore (shared port / server impl)

```ts
interface TrafficRecordStore {
  save(record: TrafficRecord): Promise<void>;
  findById(id: string): Promise<TrafficRecord | undefined>;
  listByTunnel(tunnelId: string, opts: ListOptions): Promise<TrafficRecord[]>;
  deleteOlderThan(epochMs: number): Promise<number>;
}
```

`TrafficRecorderService` (server):

- OnModuleInit → subscribe to request lifecycle events
- Builds/updates `TrafficRecord`
- Never called from HttpForwardingService directly

### 9.4 Public REST DTOs (server → dashboard)

Prefer `/api/v1/...`. Examples (illustrative):

| Method | Path                          | Purpose                                               |
| ------ | ----------------------------- | ----------------------------------------------------- |
| `GET`  | `/api/v1/health`              | Extended health (optional; keep `/health` for probes) |
| `GET`  | `/api/v1/tunnels`             | Active (+ optionally orphaned) tunnels                |
| `GET`  | `/api/v1/tunnels/:id`         | Tunnel detail                                         |
| `GET`  | `/api/v1/tunnels/:id/traffic` | Paginated traffic for tunnel                          |
| `GET`  | `/api/v1/traffic/:requestId`  | Single exchange detail                                |

DTOs **must not** expose Nest entities, WebSocket clients, or repository internals.

### 9.5 Dashboard live channel

Separate from CLI tunnel WebSocket:

- Path e.g. `/api/v1/events` (WS) or SSE `/api/v1/events/stream`
- Auth/origin: reuse SecurityModule patterns; stricter than public tunnel traffic
- Payload: serialized Badger events (or a reduced dashboard view model)

---

## 10. Integration strategy

### Principle

**Subscribe, don’t intercept.** Layer 1 completes its work, then publishes. Recorders and APIs react asynchronously.

### Stepwise integration (recommended implementation order — for after approval)

| Step | Work                                                        | Risk to L1              |
| ---- | ----------------------------------------------------------- | ----------------------- |
| A    | Re-export event-bus; add `eventId`; unit tests              | None                    |
| B    | `EventModule` + inject bus; emit at documented sites        | Low (must not await)    |
| C    | `StorageModule` + `TrafficModule` subscriber                | None if subscriber-only |
| D    | `ApiModule` REST DTOs reading TunnelManager + Traffic store | None                    |
| E    | Dashboard live WS/SSE bridged from EventBus                 | None                    |
| F    | Dashboard UI pages                                          | None                    |

### Emission sites (server)

| Site                                  | Events               |
| ------------------------------------- | -------------------- |
| `TunnelGateway.handleConnection`      | `ClientConnected`    |
| `TunnelGateway.handleDisconnect`      | `ClientDisconnected` |
| After successful `create` / reclaim   | `TunnelCreated`      |
| Unregister / orphan expiry            | `TunnelClosed`       |
| `HttpForwardingService.forward` start | `RequestReceived`    |
| After request frames sent             | `RequestForwarded`   |
| Response complete                     | `ResponseReturned`   |
| Timeout / error paths                 | `RequestFailed`      |

Emits must be **post-condition** and **non-blocking**. Prefer a tiny `EventPublisher` helper injected into existing services to keep call sites one-liners without forking logic.

### Security integration

- `/api/v1` protected by Origin middleware + HTTP rate limits (existing SecurityModule hooks)
- Dashboard WS admitted via explicit policy (similar to gateway, separate from CLI limits)
- Do not weaken CLI tunnel security to accommodate the dashboard

### Testing gates

Every Phase 2 module: unit + integration.  
Regression: existing unit + e2e suites must stay green.  
New e2e: API list tunnels while CLI session active; traffic appears after one proxied request.

---

## 11. Migration strategy

### From today’s codebase

1. **Empty dirs** `apps/server/src/events`, `apps/server/src/traffic` — replace with real modules (no leftover ghosts).
2. **EventBus** — already written; export + wire; align payloads with `eventId`.
3. **No protocol migration** — wire format unchanged; clients on `@hridhin-k/badger-cli@1.1.0` keep working.
4. **Env vars** — add only new optional vars (e.g. traffic body size cap, API CORS). Keep `BADGER_*` / `LOOPLINK_*` compat for L1.
5. **Dashboard** — replace Create Next App scaffold incrementally; ship behind `BADGER_API_BASE_URL`.
6. **Packages** — version shared via Changesets when EventBus/API types ship.

### Backward compatibility

| Consumer                    | Impact        |
| --------------------------- | ------------- |
| Existing CLI                | None          |
| Existing public tunnel URLs | None          |
| Railway `/health`           | Unchanged     |
| GitHub Packages CLI         | Unchanged     |
| Future dashboard            | New APIs only |

### Rollback

Feature-flag or omit `TrafficModule` / `ApiModule` from `AppModule` if needed — EventBus emits alone are cheap. Removing subscribers restores L1-only behavior without protocol rollback.

---

## 12. Non-functional requirements

- Subscriber work must not block the event loop for large bodies; cap stored body bytes; prefer metadata-first records.
- In-memory stores are process-local (same constraint as current tunnel map — single Railway replica).
- Document single-replica limitation for dashboard accuracy under horizontal scale.

---

## 13. Success criteria

Phase 2 is complete when:

1. Layer 1 e2e suite still passes unchanged.
2. EventBus is exported, globally injectable, and emits for tunnel + request lifecycle.
3. TrafficRecorder persists exchanges via StorageProvider / TrafficRecordStore without being imported by HttpForwardingService.
4. `/api/v1/tunnels` and `/api/v1/traffic...` return DTOs for an active session.
5. Dashboard displays live tunnels and recent traffic using **only** public APIs.
6. Docs updated (`event-bus`, `traffic-recorder`, `dashboard`, this architecture).

---

## 14. Open decisions (finalize before coding)

| #   | Decision                      | Options                                      | Recommendation                                                            |
| --- | ----------------------------- | -------------------------------------------- | ------------------------------------------------------------------------- |
| 1   | Live updates transport        | WebSocket vs SSE                             | **SSE** for simpler auth/proxy; WS if bi-directional control needed later |
| 2   | Store response/request bodies | Metadata-only vs capped bodies               | **Capped bodies** (env-configurable, default small)                       |
| 3   | Tunnel list source            | Event projections vs live TunnelManager read | **Live TunnelManager read** for accuracy + events for UI feed             |
| 4   | CLI reconnect events          | Server-only vs also CLI EventBus             | **Server-only** for Phase 2                                               |
| 5   | Auth for `/api/v1`            | Open (dev) vs shared secret / token          | **Shared secret header** for production; open in local dev                |
| 6   | Shared package layout         | Folders under shared vs separate packages    | **Folders under shared** (matches `project.mdc`)                          |

---

## 15. Approval gate

**Do not implement until this document is accepted**, including answers to §14.

Upon approval, implementation proceeds in order **A → F** (§10) with no Layer 1 protocol or forwarding rewrites.
