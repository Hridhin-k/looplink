import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { StatisticsModule } from "../statistics/statistics.module.js";
import { WorkspaceModule } from "../workspaces/workspace.module.js";
import { DashboardGateway } from "./dashboard.gateway.js";
import { StatisticsNotifier } from "./statistics-notifier.js";

/**
 * Dashboard live WebSocket channel (`/dashboard/ws`) backed by the EventBus.
 * Connections require Account authentication and Membership-resolved workspace scope.
 */
@Module({
  imports: [StatisticsModule, AuthModule, WorkspaceModule],
  providers: [DashboardGateway, StatisticsNotifier],
})
export class DashboardModule {}
