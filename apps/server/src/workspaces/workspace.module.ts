import { Module, forwardRef } from "@nestjs/common";

import { AccessModule } from "../access/access.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { ApiKeyService } from "./api-keys/api-key.service.js";
import { API_KEY_REPOSITORY } from "./api-keys/api-key.tokens.js";
import { SupabaseApiKeyRepository } from "./api-keys/supabase-api-key.repository.js";
import { WorkspacePermissionGuard } from "./guards/workspace-permission.guard.js";
import { WorkspaceController } from "./workspace.controller.js";
import { SupabaseWorkspaceRepository } from "./repositories/supabase-workspace.repository.js";
import { WORKSPACE_REPOSITORY } from "./workspace.tokens.js";
import { WorkspaceService } from "./workspace.service.js";

@Module({
  imports: [forwardRef(() => AuthModule), forwardRef(() => AccessModule)],
  controllers: [WorkspaceController],
  providers: [
    {
      provide: WORKSPACE_REPOSITORY,
      useClass: SupabaseWorkspaceRepository,
    },
    {
      provide: API_KEY_REPOSITORY,
      useClass: SupabaseApiKeyRepository,
    },
    WorkspaceService,
    ApiKeyService,
    WorkspacePermissionGuard,
  ],
  exports: [
    WorkspaceService,
    ApiKeyService,
    WorkspacePermissionGuard,
    WORKSPACE_REPOSITORY,
  ],
})
export class WorkspaceModule {}
