import { Module } from "@nestjs/common";

import { TunnelGateway } from "./tunnel.gateway.js";

/**
 * Owns the WebSocket gateway that LoopLink clients connect to.
 */
@Module({
  providers: [TunnelGateway],
})
export class GatewayModule {}
