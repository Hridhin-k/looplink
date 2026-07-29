import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
  RequestMethod,
  forwardRef,
} from "@nestjs/common";

import { SecurityModule } from "../security/security.module.js";
import { WorkspaceModule } from "../workspaces/workspace.module.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { JwtAuthGuard } from "./guards/jwt-auth.guard.js";
import { MeController } from "./me.controller.js";
import { AuthMiddleware } from "./middleware/auth.middleware.js";

/**
 * Supabase Auth integration: login/logout/refresh, JWT verification, `/me`,
 * and dashboard Google OAuth (PKCE via Nest — no Supabase SDK in React).
 */
@Module({
  imports: [forwardRef(() => WorkspaceModule), SecurityModule],
  controllers: [AuthController, MeController],
  providers: [AuthService, JwtAuthGuard, AuthMiddleware],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(AuthMiddleware)
      .forRoutes(
        { path: "api/v1/me", method: RequestMethod.ALL },
        { path: "api/v1/auth/logout", method: RequestMethod.POST },
      );
  }
}
