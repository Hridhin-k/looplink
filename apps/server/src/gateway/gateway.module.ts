import { Module } from "@nestjs/common";

import { HttpForwardModule } from "../http-forward/http-forward.module.js";
import { TunnelModule } from "../tunnel/tunnel.module.js";
import { TunnelGateway } from "./tunnel.gateway.js";

/**
 * Owns the WebSocket gateway that LoopLink clients connect to.
 */
@Module({
  imports: [TunnelModule, HttpForwardModule],
  providers: [TunnelGateway],
})
export class GatewayModule {}
