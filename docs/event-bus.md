# EventBus architecture

Badger uses an internal, typed EventBus so future modules (inspector, AI engine,
plugins) can observe tunnel lifecycle without coupling to forwarding or protocol
code.

## Goals

- Strongly typed publish / subscribe / unsubscribe
- No external dependencies
- Dependency-injection friendly
- Zero impact on tunnel control flow and protocol contracts

## Placement

The EventBus module lives at:

```
packages/shared/src/event-bus/
  badger-events.ts       Event names + payload types
  event-bus.ts           EventBus interface (publish / subscribe)
  in-memory-event-bus.ts Default dependency-free implementation
  create-event-bus.ts    Factory for DI composition roots
  tokens.ts              EVENT_BUS injection symbol
  index.ts               Public exports
```

Import paths:

```ts
// Re-exported from the shared package root
import { createEventBus, BadgerEventType } from "@hridhin-k/badger-shared";

// Or the dedicated subpath
import { createEventBus, BadgerEventType } from "@hridhin-k/badger-shared/event-bus";
```

Apps depend on the `EventBus` interface. They must not import NestJS or CLI
types into the shared package.

## API

| Method                     | Role                                                   |
| -------------------------- | ------------------------------------------------------ |
| `publish(type, payload)`   | Emit a typed lifecycle event to current subscribers    |
| `subscribe(type, handler)` | Register a typed handler; returns `{ unsubscribe() }`  |
| `unsubscribe()`            | Cancel a single subscription (via the returned handle) |
| `clear()`                  | Drop every subscription (tests / shutdown)             |

Subscriber failures (sync throws or async rejections) are isolated so publishers
and tunnel control flow are never affected.

## Design decisions

| Decision                       | Rationale                                                                         |
| ------------------------------ | --------------------------------------------------------------------------------- |
| Typed `BadgerEventMap`         | Compile-time guarantee that `TunnelCreated` handlers receive `TunnelCreatedEvent` |
| In-memory only                 | Smallest production-ready bus; no Redis / Node `EventEmitter` dependency          |
| Isolate subscriber errors      | A broken observer cannot break tunnels                                            |
| Fire-and-forget publish        | Publishing never awaits handlers; async rejections are swallowed                  |
| `@Global()` Nest module        | One shared bus instance across gateway, tunnel, and HTTP modules                  |
| Optional CLI `eventBus` option | Composition root can inject a shared bus; default is an isolated in-memory bus    |

## Lifecycle events

| Event                | Emitter                 | When                                   |
| -------------------- | ----------------------- | -------------------------------------- |
| `TunnelCreated`      | `TunnelManager`         | After a tunnel is created or reclaimed |
| `TunnelClosed`       | `TunnelManager`         | After unregister / orphan expiry purge |
| `ClientConnected`    | `TunnelGateway`         | After a WebSocket client is admitted   |
| `ClientDisconnected` | `TunnelGateway`         | After disconnect cleanup               |
| `RequestReceived`    | `HttpForwardingService` | Public HTTP forward begins             |
| `RequestForwarded`   | `HttpForwardingService` | Request frames sent to the CLI         |
| `ResponseReturned`   | `HttpForwardingService` | CLI response start received            |
| `RequestFailed`      | `HttpForwardingService` | Forward fails or times out             |
| `ReconnectStarted`   | `BadgerWebSocketClient` | A reconnect attempt begins             |
| `ReconnectSucceeded` | `BadgerWebSocketClient` | Tunnel restored after reconnect        |

Protocol messages such as `tunnel_created` are unchanged. Lifecycle events are
parallel observability signals, not wire-format changes.

## Integration points

### Server

`EventModule` binds `EVENT_BUS` → `createEventBus()` and is imported once from
`AppModule`. Services inject `@Inject(EVENT_BUS) eventBus: EventBus` and publish
after successful (or failed) side effects. Return values and protocol replies
are unchanged.

### CLI

`BadgerWebSocketClient` accepts `options.eventBus`. When omitted it creates a
private bus so reconnect emissions never require callers to wire DI. Tests and
future CLI features can pass a shared instance to observe reconnect events.

## Usage

```ts
import {
  BadgerEventType,
  EVENT_BUS,
  createEventBus,
  type EventBus,
} from "@hridhin-k/badger-shared/event-bus";

const bus: EventBus = createEventBus();

const subscription = bus.subscribe(BadgerEventType.TunnelCreated, (event) => {
  console.log(event.tunnelId, event.publicUrl);
});

// later
subscription.unsubscribe();
```

NestJS:

```ts
constructor(@Inject(EVENT_BUS) private readonly eventBus: EventBus) {}
```

## Non-goals

- Cross-process fan-out
- Persistent event logs
- Changing tunnel protocol or CLI commands
- Coupling the bus to request forwarding internals beyond additive publishes
