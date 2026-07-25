import { Module } from "@nestjs/common";

import { MemoryTunnelRepository } from "./memory-tunnel.repository.js";
import { TUNNEL_REPOSITORY } from "./tunnel.constants.js";
import { TunnelManager } from "./tunnel.manager.js";

/**
 * Domain module for tunnel session orchestration.
 *
 * Provides {@link TunnelManager} backed by an in-memory {@link TunnelRepository}.
 */
@Module({
  providers: [
    {
      provide: TUNNEL_REPOSITORY,
      useClass: MemoryTunnelRepository,
    },
    TunnelManager,
  ],
  exports: [TunnelManager],
})
export class TunnelModule {}
