import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import type { DatabaseClient } from "./database-client.js";
import { DATABASE_CLIENT, SUPABASE_CONFIG } from "./database.tokens.js";
import type { SupabaseConfig } from "./supabase.config.js";

/**
 * Verifies Supabase connectivity at process start when integration is enabled.
 *
 * Does not change `/health` or tunnel behavior. When Supabase is disabled,
 * startup continues without a database (Phase 1–2 compatible).
 */
@Injectable()
export class DatabaseConnectivityService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseConnectivityService.name);

  /**
   * @param config - Resolved Supabase configuration.
   * @param database - Database-agnostic client used for the ping.
   */
  constructor(
    @Inject(SUPABASE_CONFIG) private readonly config: SupabaseConfig,
    @Inject(DATABASE_CLIENT) private readonly database: DatabaseClient,
  ) {}

  /**
   * Pings Supabase when enabled; no-ops when disabled.
   */
  async onModuleInit(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.log("Supabase disabled (no SUPABASE_* env vars); skipping connectivity check.");
      return;
    }

    await this.database.ping();
    this.logger.log(`Supabase connectivity verified (${this.config.url}).`);
  }
}
