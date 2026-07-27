import type { BadgerEventMap } from "./badger-events.js";
import type { EventBus, EventHandler, EventSubscription } from "./event-bus.js";

/**
 * In-process {@link EventBus} with no external dependencies.
 *
 * Handlers are stored per event type. Publish iterates a snapshot so a handler
 * may safely unsubscribe (or subscribe siblings) during delivery. Failures in
 * handlers never escape {@link publish}.
 */
export class InMemoryEventBus implements EventBus {
  private readonly listeners = new Map<keyof BadgerEventMap, Set<EventHandler<unknown>>>();

  /**
   * Publishes `payload` to every handler subscribed to `type`.
   *
   * @typeParam TEvent - Event name from {@link BadgerEventMap}.
   * @param type - Event to publish.
   * @param payload - Typed payload for `type`.
   */
  publish<TEvent extends keyof BadgerEventMap>(
    type: TEvent,
    payload: BadgerEventMap[TEvent],
  ): void {
    const handlers = this.listeners.get(type);
    if (handlers === undefined || handlers.size === 0) {
      return;
    }

    for (const handler of [...handlers]) {
      this.invoke(handler, payload);
    }
  }

  /**
   * Registers `handler` for `type`.
   *
   * @typeParam TEvent - Event name from {@link BadgerEventMap}.
   * @param type - Event to listen for.
   * @param handler - Callback receiving the typed payload.
   * @returns A subscription that removes this handler.
   */
  subscribe<TEvent extends keyof BadgerEventMap>(
    type: TEvent,
    handler: EventHandler<BadgerEventMap[TEvent]>,
  ): EventSubscription {
    let handlers = this.listeners.get(type);
    if (handlers === undefined) {
      handlers = new Set();
      this.listeners.set(type, handlers);
    }

    const stored: EventHandler<unknown> = (payload) => {
      return handler(payload as BadgerEventMap[TEvent]);
    };
    handlers.add(stored);

    let active = true;

    return {
      unsubscribe: (): void => {
        if (!active) {
          return;
        }

        active = false;
        handlers.delete(stored);

        if (handlers.size === 0) {
          this.listeners.delete(type);
        }
      },
    };
  }

  /**
   * Drops all subscriptions.
   */
  clear(): void {
    this.listeners.clear();
  }

  private invoke(handler: EventHandler<unknown>, payload: unknown): void {
    try {
      const result = handler(payload);
      if (isPromiseLike(result)) {
        void result.catch(() => {
          // Async subscriber failures must not become unhandled rejections
          // that tear down the process or the tunnel session.
        });
      }
    } catch {
      // Sync subscriber failures must not interrupt publishers.
    }
  }
}

/**
 * Narrows an unknown return value to a thenable.
 *
 * @param value - Value returned by a handler.
 * @returns `true` when `value` looks like a Promise.
 */
function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof value.then === "function"
  );
}
