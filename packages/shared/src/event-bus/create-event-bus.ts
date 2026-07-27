import type { EventBus } from "./event-bus.js";
import { InMemoryEventBus } from "./in-memory-event-bus.js";

/**
 * Creates a new in-memory {@link EventBus} for dependency injection.
 *
 * Composition roots (Nest modules, CLI factories, tests) should call this once
 * per process and share the instance so publishers and subscribers meet.
 *
 * @returns A fresh {@link InMemoryEventBus}.
 */
export function createEventBus(): EventBus {
  return new InMemoryEventBus();
}
