import { Controller, Get } from "@nestjs/common";

import type { HealthResponse } from "./health.types.js";

/**
 * HTTP controller that reports process liveness.
 */
@Controller("health")
export class HealthController {
  /**
   * Returns a fixed liveness payload.
   *
   * @returns `{ status: "ok" }` when the HTTP process is accepting traffic.
   */
  @Get()
  getHealth(): HealthResponse {
    return { status: "ok" };
  }
}
