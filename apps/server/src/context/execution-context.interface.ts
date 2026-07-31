import type { ContextMetadata, ContextType } from "./context-type.js";

/**
 * Base contract for every Badger execution context.
 *
 * Concrete contexts ({@link import("./anonymous/anonymous-context.js").AnonymousContext},
 * {@link import("./workspace/workspace-context.js").WorkspaceContext}) implement this.
 * Business services must not consume these types directly — only
 * {@link import("./tunnel-context.interface.js").TunnelContext}.
 */
export interface ExecutionContext {
  /** Unique id for this resolved context instance (tracing). */
  readonly contextId: string;
  /** Discriminator for the concrete context implementation. */
  readonly type: ContextType;
  /** Epoch ms when this context was created. */
  readonly createdAt: number;
  /** Immutable transport / tracing metadata (never secrets). */
  readonly metadata: ContextMetadata;
}
