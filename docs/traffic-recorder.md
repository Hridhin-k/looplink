# Badger TrafficRecorder

Captures every public HTTP exchange for later inspection (dashboard, AI tooling)
**without** participating in request forwarding.

## Architecture

```text
Publishers (future; Layer 1 exits only)
        │  fire-and-forget EventBus.publish
        ▼
   InMemoryEventBus
        │
        ▼
   TrafficRecorder  (subscriber)
        │
        ▼
   TrafficRecordStore
        │
        ▼
   StorageProvider  (memory today; SQLite / Postgres / Redis / S3 later)
```

**Subscribe, don’t intercept.** `TrafficRecorder` never imports or wraps
`HttpForwardingService`, the gateway, or CLI forwarders. It only reacts to
typed EventBus payloads.

## Dependency graph

```text
apps/server TrafficModule
    │ injects EVENT_BUS + STORAGE_PROVIDER
    ▼
TrafficRecorderService → TrafficRecorder (shared)
                              │
                              ▼
                     StorageTrafficRecordStore
                              │
                              ▼
                        StorageProvider
```

`packages/shared/traffic` depends on `event-bus` + `storage`. It never depends
on Nest controllers or forwarding modules.

## Folder structure

```text
packages/shared/src/traffic/
  traffic-body.ts                 # TrafficBody + createTrafficBody (truncation)
  traffic-record.ts               # TrafficRecord shape
  traffic-record-store.ts         # Persistence port
  storage-traffic-record-store.ts # StorageProvider-backed implementation
  traffic-recorder.ts             # EventBus subscriber (framework-free)
  constants.ts / tokens.ts
  index.ts
  *.spec.ts

apps/server/src/traffic/
  traffic.module.ts
  traffic-recorder.service.ts     # Nest OnModuleInit adapter
  *.spec.ts
```

## Public interfaces

### TrafficRecord

| Field             | Source                        |
| ----------------- | ----------------------------- |
| `requestId`       | `RequestReceived`             |
| `timestamp`       | `RequestReceived.occurredAt`  |
| `method`          | `RequestReceived`             |
| `path`            | `RequestReceived`             |
| `headers`         | `RequestReceived`             |
| `query`           | `RequestReceived`             |
| `body`            | `RequestReceived`             |
| `tunnelId`        | `RequestReceived`             |
| `status`          | `ResponseReturned.statusCode` |
| `responseHeaders` | `ResponseReturned`            |
| `responseBody`    | `ResponseReturned`            |
| `latencyMs`       | `ResponseReturned`            |
| `error`           | `RequestFailed`               |

### TrafficBody (large payloads)

```ts
interface TrafficBody {
  byteLength: number; // original size
  truncated: boolean;
  dataBase64: string; // retained bytes only (≤ maxBodyBytes)
}
```

- Default cap: **64 KiB** per request/response (`DEFAULT_MAX_RECORDED_BODY_BYTES`)
- Publishers should call `createTrafficBody(bytes)` before `publish`
- The store re-caps on `save` / `update` (defense in depth)
- `list({ includeBodies: false })` returns size metadata without base64 payloads

### TrafficRecordStore

```ts
interface TrafficRecordStore {
  save(record: TrafficRecord): Promise<void>;
  update(requestId: string, patch: TrafficRecordPatch): Promise<TrafficRecord | undefined>;
  findById(requestId: string): Promise<TrafficRecord | undefined>;
  list(options?: ListTrafficRecordsOptions): Promise<readonly TrafficRecord[]>;
  clear(): Promise<void>;
  size(): Promise<number>;
}
```

Retention default: **1000** records (oldest evicted first).

## Event contracts

`RequestReceived` and `ResponseReturned` carry the capture fields above
(additive on `BadgerEventMap`). Emitters are **not** wired into the frozen
forward path yet; when they are, they must publish post-condition and
never `await` the bus.

## Usage

```ts
import {
  BadgerEventType,
  createEventBus,
  createEventPayload,
  createStorageProvider,
  createTrafficBody,
  StorageTrafficRecordStore,
  TrafficRecorder,
} from "@hridhin-k/badger-shared";

const eventBus = createEventBus();
const store = new StorageTrafficRecordStore(createStorageProvider());
const recorder = new TrafficRecorder(eventBus, store);
recorder.start();

eventBus.publish(
  BadgerEventType.RequestReceived,
  createEventPayload({
    tunnelId: "tun-1",
    requestId: "req-1",
    method: "GET",
    path: "/",
    headers: {},
    query: {},
    body: createTrafficBody(undefined),
    correlationId: "req-1",
  }),
);
```

### NestJS

`AppModule` imports `TrafficModule`, which binds `TRAFFIC_RECORD_STORE` on top
of `STORAGE_PROVIDER` and starts `TrafficRecorderService` on init.

## Extension points

| Extension                    | How                                                         |
| ---------------------------- | ----------------------------------------------------------- |
| Swap storage backend         | Change `StorageModule` / `createStorageProvider` only       |
| Custom retention / body caps | Pass options to `StorageTrafficRecordStore`                 |
| REST `/api/v1/traffic`       | Inject `TrafficRecorderService` / `TRAFFIC_RECORD_STORE`    |
| Emit from Layer 1            | `eventBus.publish(...)` after success/failure; do not await |

## Non-goals

- Dashboard UI / REST listing endpoints (later)
- Changing CLI protocol or public URL routing
- Synchronous work on the HTTP forward hot path
