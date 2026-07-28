import { Module } from "@nestjs/common";

import { ReplayModule } from "../replay/replay.module.js";
import { StatisticsModule } from "../statistics/statistics.module.js";
import { TrafficModule } from "../traffic/traffic.module.js";
import { InspectorController } from "./inspector.controller.js";
import { InspectorService } from "./inspector.service.js";

/**
 * Nest module exposing the inspector management REST API.
 *
 * Routes under `/api/v1/inspector` — no authentication.
 */
@Module({
  imports: [TrafficModule, StatisticsModule, ReplayModule],
  controllers: [InspectorController],
  providers: [InspectorService],
  exports: [InspectorService],
})
export class InspectorModule {}
