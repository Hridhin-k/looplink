import type { BadgerEventMap } from "./badger-events.js";

/**
 * Handler invoked when a matching event is published.
 *
 * Async handlers are supported; rejections are isolated by the bus so they
 * never propagate into tunnel control flow.
 *
 * @typeParam TPayload - Payload type for the subscribed event.
 */
export type EventHandler<TPayload> = (payload: TPayload) => void | Promise<void>;

/**
 * Handle returned by {@link EventBus.subscribe} / {@link EventBus.once}.
 */
export interface EventSubscription {
  /**
   * Removes the associated handler. Idempotent.
   */
  unsubscribe(): void;
}

/**
 * Typed publish/subscribe bus for Badger lifecycle events.
 *
 * Implementations must:
 * - deliver only to handlers subscribed to the published event type
 * - isolate subscriber failures from publishers (zero impact on tunnel flow)
 * - remain free of NestJS / framework coupling so CLI and server can both inject
 *
 * @typeParam TMap - Event name → payload map (defaults to {@link BadgerEventMap}).
 */
export interface EventBus<TMap extends BadgerEventMap = BadgerEventMap> {
  /**
   * Publishes an event to all current subscribers of that type.
   *
   * @typeParam TEvent - Event name from the map.
   * @param type - Event to publish.
   * @param payload - Immutable typed payload for `type`.
   */
  publish<TEvent extends keyof TMap>(type: TEvent, payload: TMap[TEvent]): void;

  /**
   * Registers a handler for a single event type.
   *
   * @typeParam TEvent - Event name from the map.
   * @param type - Event to listen for.
   * @param handler - Callback receiving the typed payload.
   * @returns A subscription that can be cancelled.
   */
  subscribe<TEvent extends keyof TMap>(
    type: TEvent,
    handler: EventHandler<TMap[TEvent]>,
  ): EventSubscription;

  /**
   * Removes a previously registered handler for `type`.
   *
   * Idempotent when the handler is not registered.
   *
   * @typeParam TEvent - Event name from the map.
   * @param type - Event the handler was registered for.
   * @param handler - Exact function reference passed to {@link subscribe} or {@link once}.
   */
  unsubscribe<TEvent extends keyof TMap>(type: TEvent, handler: EventHandler<TMap[TEvent]>): void;

  /**
   * Registers a handler that runs at most once for `type`, then unsubscribes.
   *
   * @typeParam TEvent - Event name from the map.
   * @param type - Event to listen for.
   * @param handler - Callback receiving the typed payload.
   * @returns A subscription that can cancel before the first delivery.
   */
  once<TEvent extends keyof TMap>(
    type: TEvent,
    handler: EventHandler<TMap[TEvent]>,
  ): EventSubscription;

  /**
   * Removes every subscription. Intended for tests and process shutdown.
   */
  clear(): void;
}
