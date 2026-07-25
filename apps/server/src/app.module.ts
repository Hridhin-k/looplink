import { Module } from "@nestjs/common";

import { GatewayModule } from "./gateway/gateway.module.js";
import { HealthModule } from "./health/health.module.js";
import { TunnelModule } from "./tunnel/tunnel.module.js";

/**
 * Root application module. Composes the health, gateway, and tunnel features.
 */
@Module({
  imports: [HealthModule, GatewayModule, TunnelModule],
})
export class AppModule {}
