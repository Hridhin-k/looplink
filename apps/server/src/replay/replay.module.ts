import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { HttpForwardModule } from "../http-forward/http-forward.module.js";
import { TrafficModule } from "../traffic/traffic.module.js";
import { TunnelModule } from "../tunnel/tunnel.module.js";
import { ReplayController } from "./replay.controller.js";
import { RequestReplayService } from "./request-replay.service.js";

/**
 * Request replay: loads traffic records and reuses {@link HttpForwardingService}.
 */
@Module({
  imports: [TrafficModule, TunnelModule, HttpForwardModule, AuthModule],
  controllers: [ReplayController],
  providers: [RequestReplayService],
  exports: [RequestReplayService],
})
export class ReplayModule {}
