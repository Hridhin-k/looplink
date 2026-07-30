import { Controller, Get, Inject, ServiceUnavailableException } from "@nestjs/common";

import type { DatabaseClient } from "../database/database-client.js";
import { DATABASE_CLIENT, SUPABASE_CONFIG } from "../database/database.tokens.js";
import type { SupabaseConfig } from "../database/supabase.config.js";
import type { HealthResponse, ReadyResponse } from "./health.types.js";

/**
 * HTTP controller that reports process liveness and dependency readiness.
 */
@Controller("health")
export class HealthController {
  constructor(
    @Inject(SUPABASE_CONFIG) private readonly config: SupabaseConfig,
    @Inject(DATABASE_CLIENT) private readonly database: DatabaseClient,
  ) {}

  /**
   * Returns a fixed liveness payload.
   */
  @Get()
  getHealth(): HealthResponse {
    return { status: "ok" };
  }

  /**
   * Verifies critical dependencies (database) before receiving traffic.
   */
  @Get("ready")
  async getReady(): Promise<ReadyResponse> {
    if (!this.config.enabled) {
      return { status: "ready", checks: { database: "skip" } };
    }

    try {
      await this.database.ping();
      return { status: "ready", checks: { database: "ok" } };
    } catch {
      throw new ServiceUnavailableException({
        status: "not_ready",
        checks: { database: "error" },
      } satisfies ReadyResponse);
    }
  }
}
