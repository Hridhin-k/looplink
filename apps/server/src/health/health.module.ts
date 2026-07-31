import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module.js";
import { HealthController } from "./health.controller.js";

/**
 * Provides the public health-check HTTP surface (liveness + readiness).
 */
@Module({
  imports: [DatabaseModule],
  controllers: [HealthController],
})
export class HealthModule {}
