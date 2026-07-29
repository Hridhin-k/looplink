import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
  RequestMethod,
} from "@nestjs/common";

import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { JwtAuthGuard } from "./guards/jwt-auth.guard.js";
import { MeController } from "./me.controller.js";
import { AuthMiddleware } from "./middleware/auth.middleware.js";

/**
 * Supabase Auth integration: login/logout/refresh, JWT verification, `/me`.
 *
 * Does not introduce workspaces, CLI auth, or tunnel ownership.
 */
@Module({
  controllers: [AuthController, MeController],
  providers: [AuthService, JwtAuthGuard, AuthMiddleware],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule implements NestModule {
  /**
   * Applies {@link AuthMiddleware} to protected auth surfaces.
   *
   * @param consumer - Nest middleware consumer.
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(AuthMiddleware)
      .forRoutes(
        { path: "api/v1/me", method: RequestMethod.ALL },
        { path: "api/v1/auth/logout", method: RequestMethod.POST },
      );
  }
}
