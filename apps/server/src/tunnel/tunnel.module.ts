import { Module } from "@nestjs/common";

import { SUPABASE_CONFIG } from "../database/database.tokens.js";
import type { SupabaseConfig } from "../database/supabase.config.js";
import { AnonymousSessionController } from "./anonymous-session.controller.js";
import {
  ANONYMOUS_SESSION_REPOSITORY,
  type AnonymousSessionRepository,
} from "./anonymous-session.repository.js";
import { AnonymousSessionService } from "./anonymous-session.service.js";
import { MemoryAnonymousSessionRepository } from "./memory-anonymous-session.repository.js";
import { MemoryTunnelRepository } from "./memory-tunnel.repository.js";
import { SupabaseAnonymousSessionRepository } from "./supabase-anonymous-session.repository.js";
import { TUNNEL_REPOSITORY } from "./tunnel.constants.js";
import { TunnelManager } from "./tunnel.manager.js";
import { TunnelOwnershipStore } from "./tunnel-ownership.store.js";

/**
 * Domain module for tunnel session orchestration and anonymous ownership.
 *
 * Provides {@link TunnelManager} backed by an in-memory {@link TunnelRepository},
 * plus ephemeral {@link AnonymousSessionService} for unauthenticated CLI tunnels.
 */
@Module({
  controllers: [AnonymousSessionController],
  providers: [
    {
      provide: TUNNEL_REPOSITORY,
      useClass: MemoryTunnelRepository,
    },
    TunnelOwnershipStore,
    {
      provide: ANONYMOUS_SESSION_REPOSITORY,
      useFactory: (
        config: SupabaseConfig,
        supabaseRepo: SupabaseAnonymousSessionRepository,
        memoryRepo: MemoryAnonymousSessionRepository,
      ): AnonymousSessionRepository => (config.enabled ? supabaseRepo : memoryRepo),
      inject: [SUPABASE_CONFIG, SupabaseAnonymousSessionRepository, MemoryAnonymousSessionRepository],
    },
    SupabaseAnonymousSessionRepository,
    MemoryAnonymousSessionRepository,
    AnonymousSessionService,
    TunnelManager,
  ],
  exports: [TunnelManager, AnonymousSessionService],
})
export class TunnelModule {}
