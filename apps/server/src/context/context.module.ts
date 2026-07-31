import { Global, Module, forwardRef } from "@nestjs/common";

import { AccessModule } from "../access/access.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { TunnelModule } from "../tunnel/tunnel.module.js";
import { WorkspaceModule } from "../workspaces/workspace.module.js";
import { ContextFactory } from "./context.factory.js";
import { ContextResolver } from "./context.resolver.js";
import { ContextAuthGuard } from "./guards/context-auth.guard.js";
import { ContextSessionStore } from "./providers/context-session.store.js";

/**
 * Context Engine — single source of truth for request identity and authorization.
 *
 * Global so HTTP controllers, CLI tunnel gateway, and dashboard gateway share
 * one resolver without re-importing auth plumbing.
 */
@Global()
@Module({
  imports: [
    AccessModule,
    forwardRef(() => AuthModule),
    forwardRef(() => WorkspaceModule),
    forwardRef(() => TunnelModule),
  ],
  providers: [ContextFactory, ContextResolver, ContextSessionStore, ContextAuthGuard],
  exports: [ContextFactory, ContextResolver, ContextSessionStore, ContextAuthGuard],
})
export class ContextModule {}
