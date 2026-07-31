import type { WorkspacePermission } from "../workspaces/workspace.permissions.js";
import type { ContextMetadata, ContextType } from "./context-type.js";

/**
 * Immutable execution context visible to business services.
 *
 * Authentication mechanism, Supabase, JWT shape, and workspace kind are hidden
 * behind {@link import("./context.resolver.js").ContextResolver}. Services must
 * only inspect this object (and DTOs), never re-resolve identity.
 */
export interface TunnelContext {
  /** Unique id for this resolved context instance (tracing). */
  readonly contextId: string;
  /** Resolved context type. */
  readonly contextType: ContextType;
  /**
   * Active tunnel id when known.
   *
   * `null` for HTTP API calls that are not yet bound to a live tunnel, and for
   * dashboard sessions before a tunnel event arrives.
   */
  readonly tunnelId: string | null;
  /** Workspace owner when context is workspace-scoped; otherwise `null`. */
  readonly workspaceId: string | null;
  /** Anonymous session owner when context is anonymous; otherwise `null`. */
  readonly anonymousSessionId: string | null;
  /**
   * Permissions resolved once at admission.
   *
   * Business services inspect this set — they must not call PermissionService.
   */
  readonly permissions: ReadonlySet<WorkspacePermission>;
  /** Immutable metadata for logging / tracing. */
  readonly metadata: ContextMetadata;
}

/**
 * Returns whether {@link TunnelContext.permissions} includes `permission`.
 */
export function contextHasPermission(
  context: TunnelContext,
  permission: WorkspacePermission,
): boolean {
  return context.permissions.has(permission);
}

/**
 * Fields useful for structured logging across services.
 */
export function contextLogFields(
  context: TunnelContext,
  extras: { readonly requestId?: string } = {},
): Readonly<Record<string, string | null>> {
  return {
    contextId: context.contextId,
    tunnelId: context.tunnelId,
    workspaceId: context.workspaceId,
    requestId: extras.requestId ?? null,
  };
}
