import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { HeartbeatMonitor } from "./heartbeat.monitor.js";
import { TunnelGateway } from "./tunnel.gateway.js";
import { HttpForwardModule } from "../http-forward/http-forward.module.js";
import { SecurityModule } from "../security/security.module.js";
import { TunnelModule } from "../tunnel/tunnel.module.js";
import { WorkspaceModule } from "../workspaces/workspace.module.js";

/**
 * Owns the WebSocket gateway that Badger clients connect to.
 */
@Module({
  imports: [AuthModule, WorkspaceModule, TunnelModule, HttpForwardModule, SecurityModule],
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
