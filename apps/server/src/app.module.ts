import { Module } from "@nestjs/common";

import { GatewayModule } from "./gateway/gateway.module.js";
import { HealthModule } from "./health/health.module.js";
import { HttpForwardModule } from "./http-forward/http-forward.module.js";
import { TunnelModule } from "./tunnel/tunnel.module.js";

/**
 * Root application module. Composes the health, gateway, tunnel, and HTTP
 * forwarding features.
 */
@Module({
  imports: [HealthModule, TunnelModule, HttpForwardModule, GatewayModule],
})
export class AppModule {}
