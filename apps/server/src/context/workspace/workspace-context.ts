import type { WorkspacePermission } from "../../workspaces/workspace.permissions.js";
import type { WorkspaceRole } from "../../workspaces/workspace.types.js";
import type { ExecutionContext } from "../execution-context.interface.js";
import { ContextType, type ContextMetadata } from "../context-type.js";

/**
 * Execution context for authenticated workspace execution.
 *
 * Account + membership + permissions are resolved once at admission.
 */
export interface WorkspaceContext extends ExecutionContext {
  readonly type: ContextType.Workspace;
  /** Verified account id (JWT subject or API-key creator). */
  readonly accountId: string;
  /** Membership-resolved workspace id. */
  readonly workspaceId: string;
  /**
   * Membership row id.
   *
   * `null` for API-key auth (no membership row — workspace lock only).
   */
  readonly membershipId: string | null;
  /** Role used to derive {@link permissions}. */
  readonly role: WorkspaceRole;
  /** Immutable permission set resolved at admission. */
  readonly permissions: ReadonlySet<WorkspacePermission>;
  /**
   * Bound tunnel id when known.
   *
   * `null` for HTTP / dashboard sessions until a tunnel is created.
   */
  readonly tunnelId: string | null;
}

/**
 * Builds an immutable {@link WorkspaceContext}.
 *
 * Prefer {@link import("../context.factory.js").ContextFactory}.
 */
export function createWorkspaceContext(input: {
  readonly contextId: string;
  readonly accountId: string;
  readonly workspaceId: string;
  readonly membershipId: string | null;
  readonly role: WorkspaceRole;
  readonly permissions: ReadonlySet<WorkspacePermission>;
  readonly createdAt: number;
  readonly tunnelId?: string | null;
  readonly metadata?: ContextMetadata;
}): WorkspaceContext {
  return Object.freeze({
    contextId: input.contextId,
    type: ContextType.Workspace,
    createdAt: input.createdAt,
    accountId: input.accountId,
    workspaceId: input.workspaceId,
    membershipId: input.membershipId,
    role: input.role,
    permissions: input.permissions,
    tunnelId: input.tunnelId ?? null,
    metadata: Object.freeze({ ...(input.metadata ?? {}) }),
  });
}
