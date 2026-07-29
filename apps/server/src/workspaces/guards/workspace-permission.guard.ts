import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import type { AuthUser } from "../../auth/auth.types.js";
import { WORKSPACE_PERMISSION_KEY } from "../decorators/require-workspace-permission.decorator.js";
import {
  apiKeyHasPermission,
  type WorkspacePermission,
  roleHasPermission,
} from "../workspace.permissions.js";
import { WorkspaceService } from "../workspace.service.js";
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
}

/**
 * Enforces {@link RequireWorkspacePermission} against server-resolved membership.
 *
 * Never trusts client-supplied roles — membership is loaded from the repository.
 */
@Injectable()
export class WorkspacePermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly workspaces: WorkspaceService,
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

    if (user.authMethod === "api_key") {
      if (user.workspaceId !== workspaceId) {
        throw new ForbiddenException("API key is not valid for this workspace.");
      }
      if (!apiKeyHasPermission(permission)) {
        throw new ForbiddenException("API key does not have permission for this action.");
      }
      return true;
    }

    const member = await this.workspaces.requireMembership(workspaceId, user.id);
    if (!roleHasPermission(member.role, permission)) {
      throw new ForbiddenException("Insufficient workspace permissions.");
    }
    request.workspaceMember = member;
    return true;
  }
}
