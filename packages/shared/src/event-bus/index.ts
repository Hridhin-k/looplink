/**
 * Internal EventBus module for Badger lifecycle observability.
 *
 * @packageDocumentation
 *
 * Provides a dependency-free, strongly typed publish/subscribe bus.
 * See [docs/event-bus.md](../../../../docs/event-bus.md).
 */

export type {
  BadgerEventMap,
  ClientConnectedEvent,
  ClientDisconnectedEvent,
  ReconnectStartedEvent,
  ReconnectSucceededEvent,
  RequestFailedEvent,
  RequestForwardedEvent,
  RequestReceivedEvent,
  ResponseReturnedEvent,
  TunnelClosedEvent,
  TunnelClosedReason,
  TunnelCreatedEvent,
} from "./badger-events.js";
export { BadgerEventType } from "./badger-events.js";
export type { BadgerEventType as BadgerEventName } from "./badger-events.js";
export type { EventBus, EventHandler, EventSubscription } from "./event-bus.js";
export { createEventBus } from "./create-event-bus.js";
export { InMemoryEventBus } from "./in-memory-event-bus.js";
export { EVENT_BUS } from "./tokens.js";
