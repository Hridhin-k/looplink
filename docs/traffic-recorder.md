# TrafficRecorder architecture

TrafficRecorder captures every public HTTP exchange for later inspection
(dashboard, AI tooling) without participating in request forwarding.

## Goals

- Record request/response metadata and bodies
- In-memory storage by default
- Storage port for future persistence adapters
- Subscribe only through the EventBus
- Zero change to tunnel protocol or forwarder control flow

## Placement

```
apps/server/src/traffic/
  traffic.types.ts                 TrafficRecord shape
  traffic-record.store.ts          Persistence port (interface)
  memory-traffic-record.store.ts   In-memory adapter
  traffic-recorder.service.ts      EventBus subscriber
  traffic.module.ts                Nest wiring
  traffic.constants.ts             DI token + retention defaults
```

## Data model

Each {@link TrafficRecord} stores:

| Field                                                       | Source event                 |
| ----------------------------------------------------------- | ---------------------------- |
| `requestId`                                                 | `RequestReceived`            |
| `timestamp`                                                 | `RequestReceived.occurredAt` |
| `method` / `path` / `headers` / `body`                      | `RequestReceived`            |
| `tunnelId`                                                  | `RequestReceived`            |
| `status` / `responseHeaders` / `responseBody` / `latencyMs` | `ResponseReturned`           |
| `error`                                                     | `RequestFailed`              |

Bodies are truncated to `DEFAULT_MAX_RECORDED_BODY_BYTES` (64 KiB). The store
retains at most `DEFAULT_MAX_TRAFFIC_RECORDS` (1000) entries, evicting oldest
first.

## Event flow

```
Public HTTP → HttpForwardingService
                 │ publish RequestReceived (headers + body)
                 │ publish RequestForwarded
                 │ stream response to client (unchanged)
                 │ publish ResponseReturned (status, headers, body, latency)
                 ▼
              EventBus
                 ▼
         TrafficRecorderService → TrafficRecordStore
```

`HttpForwardingService` still streams the response as chunks arrive. It only
assembles a copy for the EventBus payload once the upstream body ends. Return
values, timeouts, and protocol frames are unchanged.

## Storage port

```ts
interface TrafficRecordStore {
  save(record: TrafficRecord): void;
  update(requestId: string, patch: TrafficRecordPatch): TrafficRecord | undefined;
  findById(requestId: string): TrafficRecord | undefined;
  list(options?: ListTrafficRecordsOptions): readonly TrafficRecord[];
  clear(): void;
  size(): number;
}
```

Swap `MemoryTrafficRecordStore` for a durable adapter later without changing
the recorder.

## Non-goals

- Dashboard UI / REST listing endpoints (later phase)
- Cross-process fan-out
- Changing CLI protocol or public URL routing
