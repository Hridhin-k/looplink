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
 * Handle returned by {@link EventBus.subscribe} to cancel a subscription.
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
 */
export interface EventBus {
  /**
   * Publishes an event to all current subscribers of that type.
   *
   * Delivery is synchronous for the publish call; async handlers run without
   * blocking the publisher. Subscriber errors are swallowed.
   *
   * @typeParam TEvent - Event name from {@link BadgerEventMap}.
   * @param type - Event to publish.
   * @param payload - Typed payload for `type`.
   */
  publish<TEvent extends keyof BadgerEventMap>(type: TEvent, payload: BadgerEventMap[TEvent]): void;

  /**
   * Registers a handler for a single event type.
   *
   * @typeParam TEvent - Event name from {@link BadgerEventMap}.
   * @param type - Event to listen for.
   * @param handler - Callback receiving the typed payload.
   * @returns A subscription that can be cancelled.
   */
  subscribe<TEvent extends keyof BadgerEventMap>(
    type: TEvent,
    handler: EventHandler<BadgerEventMap[TEvent]>,
  ): EventSubscription;

  /**
   * Removes every subscription. Intended for tests and process shutdown.
   */
  clear(): void;
}
