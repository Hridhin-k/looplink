import { Global, Module, forwardRef } from "@nestjs/common";

import { WorkspaceModule } from "../workspaces/workspace.module.js";
import { PermissionService } from "./permission.service.js";
import { WorkspaceContextService } from "./workspace-context.service.js";

/**
 * Account → Membership → Workspace authorization primitives.
 *
 * Global so controllers, gateways, and inspector can resolve RequestContext
 * without importing WorkspaceModule everywhere.
 */
@Global()
@Module({
  imports: [forwardRef(() => WorkspaceModule)],
  providers: [PermissionService, WorkspaceContextService],
  exports: [PermissionService, WorkspaceContextService],
})
export class AccessModule {}
