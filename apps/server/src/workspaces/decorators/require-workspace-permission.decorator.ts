import { SetMetadata } from "@nestjs/common";

import type { WorkspacePermission } from "../workspace.permissions.js";

export const WORKSPACE_PERMISSION_KEY = "workspacePermission";

/**
 * Requires the authenticated user to hold the given permission in the
 * workspace identified by the `:workspaceId` route param.
 */
export const RequireWorkspacePermission = (
  permission: WorkspacePermission,
): MethodDecorator & ClassDecorator => SetMetadata(WORKSPACE_PERMISSION_KEY, permission);
