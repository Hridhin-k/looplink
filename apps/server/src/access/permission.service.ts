import { ForbiddenException, Injectable } from "@nestjs/common";

import {
  API_KEY_PERMISSIONS,
  roleHasPermission,
  type WorkspacePermission,
} from "../workspaces/workspace.permissions.js";
import type { WorkspaceRole } from "../workspaces/workspace.types.js";
import type { RequestContext } from "./access.types.js";

/**
 * Central authorization. Business services must not embed permission checks.
 */
@Injectable()
export class PermissionService {
  permissionsForRole(role: WorkspaceRole): ReadonlySet<WorkspacePermission> {
    const all: WorkspacePermission[] = [
      "workspace:read",
      "workspace:update_settings",
      "workspace:invite",
      "workspace:manage_members",
      "workspace:manage_api_keys",
      "workspace:delete",
      "tunnel:create",
      "inspector:read",
      "inspector:replay",
    ];
    return new Set(all.filter((permission) => roleHasPermission(role, permission)));
  }

  permissionsForApiKey(): ReadonlySet<WorkspacePermission> {
    return API_KEY_PERMISSIONS;
  }

  can(ctx: RequestContext, permission: WorkspacePermission): boolean {
    return ctx.permissions.has(permission);
  }

  require(ctx: RequestContext, permission: WorkspacePermission): void {
    if (!this.can(ctx, permission)) {
      throw new ForbiddenException("Insufficient workspace permissions.");
    }
  }

  requireActiveMembership(ctx: RequestContext): void {
    if (ctx.authMethod === "api_key") {
      return;
    }
    if (ctx.membershipId === null) {
      throw new ForbiddenException("Active workspace membership is required.");
    }
  }
}
