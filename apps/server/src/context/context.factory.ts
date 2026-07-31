import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import type { WorkspacePermission } from "../workspaces/workspace.permissions.js";
import type { WorkspaceRole } from "../workspaces/workspace.types.js";
import {
  createAnonymousContext,
  type AnonymousContext,
} from "./anonymous/anonymous-context.js";
import { ContextType, type ContextMetadata } from "./context-type.js";
import type { TunnelContext } from "./tunnel-context.interface.js";
import {
  createWorkspaceContext,
  type WorkspaceContext,
} from "./workspace/workspace-context.js";

/**
 * Input for constructing an anonymous execution context.
 */
export interface CreateAnonymousContextInput {
  readonly anonymousSessionId: string;
  readonly expiresAt: number;
  readonly createdAt?: number;
  readonly tunnelId?: string | null;
  readonly metadata?: ContextMetadata;
}

/**
 * Input for constructing a workspace execution context.
 */
export interface CreateWorkspaceContextInput {
  readonly accountId: string;
  readonly workspaceId: string;
  readonly membershipId: string | null;
  readonly role: WorkspaceRole;
  readonly permissions: ReadonlySet<WorkspacePermission>;
  readonly createdAt?: number;
  readonly tunnelId?: string | null;
  readonly metadata?: ContextMetadata;
}

/**
 * Constructs immutable execution contexts and the business-facing TunnelContext.
 *
 * Never instantiate {@link AnonymousContext}, {@link WorkspaceContext}, or
 * {@link TunnelContext} outside this factory.
 */
@Injectable()
export class ContextFactory {
  /**
   * Builds an {@link AnonymousContext}.
   */
  createAnonymous(input: CreateAnonymousContextInput): AnonymousContext {
    return createAnonymousContext({
      contextId: randomUUID(),
      anonymousSessionId: input.anonymousSessionId.trim(),
      createdAt: input.createdAt ?? Date.now(),
      expiresAt: input.expiresAt,
      tunnelId: input.tunnelId ?? null,
      metadata: {
        origin: "anonymous",
        ...(input.metadata ?? {}),
      },
    });
  }

  /**
   * Builds a {@link WorkspaceContext}.
   */
  createWorkspace(input: CreateWorkspaceContextInput): WorkspaceContext {
    return createWorkspaceContext({
      contextId: randomUUID(),
      accountId: input.accountId,
      workspaceId: input.workspaceId.trim(),
      membershipId: input.membershipId,
      role: input.role,
      permissions: input.permissions,
      createdAt: input.createdAt ?? Date.now(),
      tunnelId: input.tunnelId ?? null,
      metadata: {
        origin: "workspace",
        role: input.role,
        accountId: input.accountId,
        ...(input.metadata ?? {}),
      },
    });
  }

  /**
   * Projects an execution context into the business-facing {@link TunnelContext}.
   */
  toTunnelContext(
    execution: AnonymousContext | WorkspaceContext,
  ): TunnelContext {
    if (execution.type === ContextType.Anonymous) {
      return Object.freeze({
        contextId: execution.contextId,
        contextType: ContextType.Anonymous,
        tunnelId: execution.tunnelId,
        workspaceId: null,
        anonymousSessionId: execution.anonymousSessionId,
        permissions: Object.freeze(new Set<WorkspacePermission>(["tunnel:create"])),
        metadata: execution.metadata,
      });
    }

    return Object.freeze({
      contextId: execution.contextId,
      contextType: ContextType.Workspace,
      tunnelId: execution.tunnelId,
      workspaceId: execution.workspaceId,
      anonymousSessionId: null,
      permissions: execution.permissions,
      metadata: execution.metadata,
    });
  }

  /**
   * Returns a copy of {@link TunnelContext} with an updated tunnel id binding.
   *
   * Contexts remain immutable — callers replace their stored reference.
   */
  withTunnelId(context: TunnelContext, tunnelId: string | null): TunnelContext {
    return Object.freeze({
      ...context,
      tunnelId,
      metadata: Object.freeze({ ...context.metadata }),
      permissions: context.permissions,
    });
  }
}
