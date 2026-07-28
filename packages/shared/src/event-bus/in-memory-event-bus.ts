import type { BadgerEventMap } from "./badger-events.js";
import type { EventBus, EventHandler, EventSubscription } from "./event-bus.js";

/**
 * In-process {@link EventBus} with no external dependencies.
 *
 * Handlers are keyed by the original function reference so
 * {@link EventBus.unsubscribe} works for both {@link EventBus.subscribe} and
 * {@link EventBus.once}. Publish iterates a snapshot so a handler may safely
 * unsubscribe during delivery. Failures in handlers never escape
 * {@link EventBus.publish}.
 *
 * @typeParam TMap - Event name → payload map.
 */
export class InMemoryEventBus<
  TMap extends BadgerEventMap = BadgerEventMap,
> implements EventBus<TMap> {
  /**
   * Per-event map of original handler → invocation wrapper.
   */
  private readonly listeners = new Map<
    keyof TMap,
    Map<EventHandler<TMap[keyof TMap]>, EventHandler<unknown>>
  >();

  /**
   * Publishes `payload` to every handler subscribed to `type`.
   *
   * @typeParam TEvent - Event name from the map.
   * @param type - Event to publish.
   * @param payload - Typed payload for `type`.
   */
  publish<TEvent extends keyof TMap>(type: TEvent, payload: TMap[TEvent]): void {
    const handlers = this.listeners.get(type);
    if (handlers === undefined || handlers.size === 0) {
      return;
    }

    for (const wrapper of [...handlers.values()]) {
      this.invoke(wrapper, payload);
    }
  }

  /**
   * Registers `handler` for `type`.
   *
   * @typeParam TEvent - Event name from the map.
   * @param type - Event to listen for.
   * @param handler - Callback receiving the typed payload.
   * @returns A subscription that removes this handler.
   */
  subscribe<TEvent extends keyof TMap>(
    type: TEvent,
    handler: EventHandler<TMap[TEvent]>,
  ): EventSubscription {
    this.register(type, handler, (payload) => handler(payload as TMap[TEvent]));

    return {
      unsubscribe: (): void => {
        this.unsubscribe(type, handler);
      },
    };
  }

  /**
   * Removes `handler` for `type` if present.
   *
   * @typeParam TEvent - Event name from the map.
   * @param type - Event the handler was registered for.
   * @param handler - Exact function reference passed to {@link subscribe} or {@link once}.
   */
  unsubscribe<TEvent extends keyof TMap>(type: TEvent, handler: EventHandler<TMap[TEvent]>): void {
    const handlers = this.listeners.get(type);
    if (handlers === undefined) {
      return;
    }

    handlers.delete(handler as EventHandler<TMap[keyof TMap]>);

    if (handlers.size === 0) {
      this.listeners.delete(type);
    }
  }

  /**
   * Registers a one-shot handler for `type`.
   *
   * @typeParam TEvent - Event name from the map.
   * @param type - Event to listen for.
   * @param handler - Callback receiving the typed payload.
   * @returns A subscription that can cancel before the first delivery.
   */
  once<TEvent extends keyof TMap>(
    type: TEvent,
    handler: EventHandler<TMap[TEvent]>,
  ): EventSubscription {
    this.register(type, handler, (payload) => {
      this.unsubscribe(type, handler);
      return handler(payload as TMap[TEvent]);
    });

    return {
      unsubscribe: (): void => {
        this.unsubscribe(type, handler);
      },
    };
  }

  /**
   * Drops all subscriptions.
   */
  clear(): void {
    this.listeners.clear();
  }

  private register<TEvent extends keyof TMap>(
    type: TEvent,
    handler: EventHandler<TMap[TEvent]>,
    wrapper: EventHandler<unknown>,
  ): void {
    let handlers = this.listeners.get(type);
    if (handlers === undefined) {
      handlers = new Map();
      this.listeners.set(type, handlers);
    }

    handlers.set(handler as EventHandler<TMap[keyof TMap]>, wrapper);
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
