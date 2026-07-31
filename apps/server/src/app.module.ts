import { Module } from "@nestjs/common";

import { AccessModule } from "./access/access.module.js";
import { AuditModule } from "./audit/audit.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { ContextModule } from "./context/context.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { EventModule } from "./events/event.module.js";
import { DashboardModule } from "./dashboard/dashboard.module.js";
import { GatewayModule } from "./gateway/gateway.module.js";
import { HealthModule } from "./health/health.module.js";
import { HttpForwardModule } from "./http-forward/http-forward.module.js";
import { InspectorModule } from "./inspector/inspector.module.js";
import { ObservabilityModule } from "./observability/observability.module.js";
import { ReplayModule } from "./replay/replay.module.js";
import { SecurityModule } from "./security/security.module.js";
import { StatisticsModule } from "./statistics/statistics.module.js";
import { StorageModule } from "./storage/storage.module.js";
import { TrafficModule } from "./traffic/traffic.module.js";
import { TunnelModule } from "./tunnel/tunnel.module.js";
import { WorkspaceModule } from "./workspaces/workspace.module.js";

/**
 * Root application module.
 */
@Module({
  imports: [
    ObservabilityModule,
    DatabaseModule,
    AuditModule,
    AccessModule,
    AuthModule,
    WorkspaceModule,
    TunnelModule,
    ContextModule,
    EventModule,
    StorageModule,
    TrafficModule,
    StatisticsModule,
    ReplayModule,
    InspectorModule,
    DashboardModule,
    SecurityModule,
    HealthModule,
    HttpForwardModule,
    GatewayModule,
  ],
})
export class AppModule {}
