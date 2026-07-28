import { Module } from "@nestjs/common";

import { EventModule } from "./events/event.module.js";
import { DashboardModule } from "./dashboard/dashboard.module.js";
import { GatewayModule } from "./gateway/gateway.module.js";
import { HealthModule } from "./health/health.module.js";
import { HttpForwardModule } from "./http-forward/http-forward.module.js";
import { InspectorModule } from "./inspector/inspector.module.js";
import { ReplayModule } from "./replay/replay.module.js";
import { SecurityModule } from "./security/security.module.js";
import { StatisticsModule } from "./statistics/statistics.module.js";
import { StorageModule } from "./storage/storage.module.js";
import { TrafficModule } from "./traffic/traffic.module.js";
import { TunnelModule } from "./tunnel/tunnel.module.js";

/**
 * Root application module. Composes security, health, tunnel, HTTP forwarding,
 * gateway, EventBus, StorageProvider, TrafficRecorder, Statistics, Replay,
 * Inspector, and Dashboard live WS (no tunnel behavior changes).
 */
@Module({
  imports: [
    EventModule,
    StorageModule,
    TrafficModule,
    StatisticsModule,
    ReplayModule,
    InspectorModule,
    DashboardModule,
    SecurityModule,
    HealthModule,
    TunnelModule,
    HttpForwardModule,
    GatewayModule,
  ],
})
export class AppModule {}
