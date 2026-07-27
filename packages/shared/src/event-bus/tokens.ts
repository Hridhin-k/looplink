/**
 * Injection token for {@link import("./event-bus.js").EventBus} implementations.
 *
 * Frameworks (NestJS) and manual composition roots bind this symbol to a
 * shared {@link import("./in-memory-event-bus.js").InMemoryEventBus} instance.
 */
export const EVENT_BUS = Symbol.for("badger.EventBus");
