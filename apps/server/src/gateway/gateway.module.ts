import { Module } from "@nestjs/common";

import { HeartbeatMonitor } from "./heartbeat.monitor.js";
import { HttpForwardModule } from "../http-forward/http-forward.module.js";
import { TunnelModule } from "../tunnel/tunnel.module.js";
import { TunnelGateway } from "./tunnel.gateway.js";

/**
 * Owns the WebSocket gateway that LoopLink clients connect to.
 */
@Module({
  imports: [TunnelModule, HttpForwardModule],
  providers: [
    TunnelGateway,
    {
      // Factory keeps the monitor's numeric constructor defaults out of DI.
      provide: HeartbeatMonitor,
      useFactory: (): HeartbeatMonitor => new HeartbeatMonitor(),
    },
  ],
})
export class GatewayModule {}
