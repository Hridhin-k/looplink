import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import type { RequestContext } from "../../access/access.types.js";
import { PermissionService } from "../../access/permission.service.js";
import { WorkspaceContextService } from "../../access/workspace-context.service.js";
import type { AuthUser } from "../../auth/auth.types.js";
import { WORKSPACE_PERMISSION_KEY } from "../decorators/require-workspace-permission.decorator.js";
import type { WorkspacePermission } from "../workspace.permissions.js";
import type { WorkspaceMember } from "../workspace.types.js";

export interface WorkspaceAuthorizedRequest {
  headers: {
    authorization?: string;
  };
  params: {
    workspaceId?: string;
  };
  authUser?: AuthUser;
  workspaceMember?: WorkspaceMember;
  requestContext?: RequestContext;
}

/**
 * Enforces {@link RequireWorkspacePermission} via Membership → PermissionService.
 *
 * Attaches {@link RequestContext} for downstream business handlers.
 */
@Injectable()
export class WorkspacePermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly workspaceContext: WorkspaceContextService,
    private readonly permissions: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.getAllAndOverride<WorkspacePermission | undefined>(
      WORKSPACE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (permission === undefined) {
      return true;
    }

    const request = context.switchToHttp().getRequest<WorkspaceAuthorizedRequest>();
    const user = request.authUser;
    if (user === undefined) {
      throw new ForbiddenException("Authentication required.");
    }

    const workspaceId = request.params.workspaceId?.trim();
    if (workspaceId === undefined || workspaceId.length === 0) {
      throw new NotFoundException("Workspace not found.");
    }

    const authorized = await this.workspaceContext.requireWorkspace(user, workspaceId);
    this.permissions.require(authorized.request, permission);
    request.requestContext = authorized.request;
    if (authorized.request.membershipId !== null) {
      request.workspaceMember = {
        id: authorized.request.membershipId,
        workspaceId: authorized.request.workspaceId,
        userId: authorized.request.accountId,
        accountId: authorized.request.accountId,
        role: authorized.request.role,
        status: "active",
        joinedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
    return true;
  }
}
