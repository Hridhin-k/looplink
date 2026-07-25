import { Module } from "@nestjs/common";

import { TunnelModule } from "../tunnel/tunnel.module.js";
import { TunnelGateway } from "./tunnel.gateway.js";

/**
 * Owns the WebSocket gateway that LoopLink clients connect to.
 */
@Module({
  imports: [TunnelModule],
  providers: [TunnelGateway],
})
export class GatewayModule {}
