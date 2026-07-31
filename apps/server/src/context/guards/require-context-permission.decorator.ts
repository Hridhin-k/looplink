import { SetMetadata } from "@nestjs/common";

import type { WorkspacePermission } from "../../workspaces/workspace.permissions.js";
import { REQUIRED_CONTEXT_PERMISSION_KEY } from "./context-auth.guard.js";

/**
 * Declares a permission that {@link ContextAuthGuard} must find on the
 * resolved {@link import("../tunnel-context.interface.js").TunnelContext}.
 */
export const RequireContextPermission = (
  permission: WorkspacePermission,
): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRED_CONTEXT_PERMISSION_KEY, permission);
