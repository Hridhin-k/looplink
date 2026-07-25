import { type MiddlewareConsumer, Module, type NestModule, RequestMethod } from "@nestjs/common";

import { GatewaySecurityPolicy } from "./gateway-security.policy.js";
import { OriginMiddleware } from "./origin.middleware.js";
import { OriginValidator } from "./origin-validator.js";
import { resolveSecurityConfig, type SecurityConfig } from "./security.config.js";
import { SECURITY_CONFIG } from "./security.tokens.js";

/**
 * Registers reusable security primitives for HTTP and WebSocket surfaces.
 */
@Module({
  providers: [
    {
      provide: SECURITY_CONFIG,
      useFactory: (): SecurityConfig => resolveSecurityConfig(),
    },
    {
      provide: OriginValidator,
      useFactory: (config: SecurityConfig): OriginValidator =>
        new OriginValidator(config.allowedOrigins),
      inject: [SECURITY_CONFIG],
    },
    {
      provide: GatewaySecurityPolicy,
      useFactory: (config: SecurityConfig, origins: OriginValidator): GatewaySecurityPolicy =>
        new GatewaySecurityPolicy(config, origins),
      inject: [SECURITY_CONFIG, OriginValidator],
    },
    OriginMiddleware,
  ],
  exports: [SECURITY_CONFIG, OriginValidator, GatewaySecurityPolicy],
})
export class SecurityModule implements NestModule {
  /**
   * Applies {@link OriginMiddleware} to every HTTP route except the liveness probe.
   *
   * @param consumer - Nest middleware consumer.
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(OriginMiddleware)
      .exclude({ path: "health", method: RequestMethod.GET })
      .forRoutes("*");
  }
}
