import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { ReplayModule } from "../replay/replay.module.js";
import { StatisticsModule } from "../statistics/statistics.module.js";
import { TrafficModule } from "../traffic/traffic.module.js";
import { WorkspaceModule } from "../workspaces/workspace.module.js";
import { InspectorController } from "./inspector.controller.js";
import { InspectorService } from "./inspector.service.js";

/**
 * Nest module exposing the inspector management REST API.
 *
 * Workspace-scoped routes verify Account → Membership server-side.
 */
@Module({
  imports: [TrafficModule, StatisticsModule, ReplayModule, AuthModule, WorkspaceModule],
  controllers: [InspectorController],
  providers: [InspectorService],
  exports: [InspectorService],
})
export class InspectorModule {}
