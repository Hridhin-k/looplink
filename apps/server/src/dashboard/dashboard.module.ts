import { Module } from "@nestjs/common";

import { StatisticsModule } from "../statistics/statistics.module.js";
import { DashboardGateway } from "./dashboard.gateway.js";
import { StatisticsNotifier } from "./statistics-notifier.js";

/**
 * Dashboard live WebSocket channel (`/dashboard/ws`) backed by the EventBus.
 */
@Module({
  imports: [StatisticsModule],
  providers: [DashboardGateway, StatisticsNotifier],
})
export class DashboardModule {}
