import type { ExecutionContext } from "../execution-context.interface.js";
import { ContextType, type ContextMetadata } from "../context-type.js";

/**
 * Execution context for unauthenticated CLI tunnel sessions.
 *
 * Contains no account information. Ownership is the anonymous session only.
 */
export interface AnonymousContext extends ExecutionContext {
  readonly type: ContextType.Anonymous;
  /** Persisted anonymous session id (DB / memory repository). */
  readonly anonymousSessionId: string;
  /**
   * Bound tunnel id when known.
   *
   * `null` until the CLI creates a tunnel on this connection.
   */
  readonly tunnelId: string | null;
  /** Epoch ms when the anonymous session expires. */
  readonly expiresAt: number;
}

/**
 * Builds an immutable {@link AnonymousContext}.
 *
 * Prefer {@link import("../context.factory.js").ContextFactory} — do not call
 * from business services.
 */
export function createAnonymousContext(input: {
  readonly contextId: string;
  readonly anonymousSessionId: string;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly tunnelId?: string | null;
  readonly metadata?: ContextMetadata;
}): AnonymousContext {
  return Object.freeze({
    contextId: input.contextId,
    type: ContextType.Anonymous,
    createdAt: input.createdAt,
    anonymousSessionId: input.anonymousSessionId,
    tunnelId: input.tunnelId ?? null,
    expiresAt: input.expiresAt,
    metadata: Object.freeze({ ...(input.metadata ?? {}) }),
  });
}
