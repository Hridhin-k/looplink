import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import type { AuthUser } from "../auth/auth.types.js";
import type { WorkspaceRepository } from "../workspaces/repositories/workspace.repository.js";
import { WORKSPACE_REPOSITORY } from "../workspaces/workspace.tokens.js";
import type { Workspace, WorkspaceRole } from "../workspaces/workspace.types.js";
import type { AuthorizedWorkspaceContext, RequestContext } from "./access.types.js";
import { PermissionService } from "./permission.service.js";

/**
 * Resolves Account → Membership → Workspace into a RequestContext.
 *
 * Never trusts client workspace IDs without verifying ACTIVE membership
 * (or API-key workspace lock).
 */
@Injectable()
export class WorkspaceContextService {
  constructor(
    @Inject(WORKSPACE_REPOSITORY)
    private readonly workspaces: WorkspaceRepository,
    private readonly permissions: PermissionService,
  ) {}

  /**
   * Builds an authorized context for the authenticated account.
   *
   * @param account - Verified account principal (from JWT or API key).
   * @param requestedWorkspaceId - Optional client preference (header/query/path).
   */
  async resolve(
    account: AuthUser,
    requestedWorkspaceId: string | undefined,
  ): Promise<AuthorizedWorkspaceContext> {
    if (account.authMethod === "api_key" && account.workspaceId) {
      return this.resolveApiKeyContext(account, requestedWorkspaceId);
    }

    const memberships = await this.workspaces.listMembershipsForUser(account.id);
    const active = memberships.filter((m) => {
      const status = m.status ?? "active";
      return status === "active";
    });

    if (active.length === 0) {
      throw new NotFoundException("No workspaces found for current account.");
    }

    const requested = requestedWorkspaceId?.trim();
    let selected = requested
      ? active.find((m) => m.workspace.id === requested)
      : undefined;

    if (requested && selected === undefined) {
      throw new NotFoundException("Workspace not found for current account.");
    }

    if (selected === undefined) {
      selected =
        active.find((m) => m.workspace.kind === "personal") ?? active[0];
    }

    if (selected === undefined) {
      throw new NotFoundException("No workspaces found for current account.");
    }

    const request = this.buildRequestContext({
      account,
      workspaceId: selected.workspace.id,
      membershipId: selected.id,
      role: selected.role,
    });

    return { request, workspace: selected.workspace };
  }

  /**
   * Resolves context for a path-param workspace that must already be authorized.
   */
  async requireWorkspace(
    account: AuthUser,
    workspaceId: string,
  ): Promise<AuthorizedWorkspaceContext> {
    return this.resolve(account, workspaceId);
  }

  private async resolveApiKeyContext(
    account: AuthUser,
    requestedWorkspaceId: string | undefined,
  ): Promise<AuthorizedWorkspaceContext> {
    const workspaceId = account.workspaceId;
    if (workspaceId === undefined) {
      throw new ForbiddenException("API key is not bound to a workspace.");
    }
    if (requestedWorkspaceId && requestedWorkspaceId !== workspaceId) {
      throw new NotFoundException("Workspace not found for current credentials.");
    }

    const workspace = await this.workspaces.findWorkspaceById(workspaceId);
    if (workspace === undefined) {
      throw new NotFoundException("Workspace not found for API key.");
    }

    const request = this.buildRequestContext({
      account,
      workspaceId: workspace.id,
      membershipId: null,
      role: "developer",
      apiKeyPermissions: true,
    });

    return { request, workspace };
  }

  private buildRequestContext(input: {
    readonly account: AuthUser;
    readonly workspaceId: string;
    readonly membershipId: string | null;
    readonly role: WorkspaceRole;
    readonly apiKeyPermissions?: boolean;
  }): RequestContext {
    const permissions = input.apiKeyPermissions
      ? this.permissions.permissionsForApiKey()
      : this.permissions.permissionsForRole(input.role);

    return {
      accountId: input.account.id,
      accountEmail: input.account.email,
      authMethod: input.account.authMethod ?? "jwt",
      workspaceId: input.workspaceId,
      membershipId: input.membershipId,
      role: input.role,
      permissions,
      ...(input.account.apiKeyId === undefined
        ? {}
        : { apiKeyId: input.account.apiKeyId }),
    };
  }
}

/** Request-local holder so context is destroyed when the HTTP/WS cycle ends. */
export class RequestContextHolder {
  private current: RequestContext | undefined;

  set(ctx: RequestContext): void {
    this.current = ctx;
  }

  get(): RequestContext | undefined {
    return this.current;
  }

  require(): RequestContext {
    if (this.current === undefined) {
      throw new ForbiddenException("Request context is not available.");
    }
    return this.current;
  }

  clear(): void {
    this.current = undefined;
  }
}
