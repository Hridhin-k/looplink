import { Module } from "@nestjs/common";

import { HealthController } from "./health.controller.js";

/**
 * Provides the public health-check HTTP surface.
 */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
