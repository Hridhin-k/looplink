import { Global, Module } from "@nestjs/common";

import {
  createSupabaseClients,
  type BadgerSupabaseClient,
  type SupabaseClients,
} from "./create-supabase-clients.js";
import type { DatabaseClient } from "./database-client.js";
import { DatabaseConnectivityService } from "./database-connectivity.service.js";
import {
  DATABASE_CLIENT,
  SUPABASE_ANON_CLIENT,
  SUPABASE_CONFIG,
  SUPABASE_SERVICE_ROLE_CLIENT,
} from "./database.tokens.js";
import { DisabledDatabaseClient } from "./disabled-database.client.js";
import { resolveSupabaseConfig, type SupabaseConfig } from "./supabase.config.js";
import { SupabaseDatabaseClient } from "./supabase-database.client.js";

/**
 * Internal token for the constructed client pair (anon + service role).
 */
const SUPABASE_CLIENTS = Symbol("SUPABASE_CLIENTS");

/**
 * Process-wide database infrastructure for Phase 3.
 *
 * Provides validated Supabase configuration, JS clients (when enabled), and a
 * database-agnostic {@link DatabaseClient}. Domain repositories bind in later
 * phases; this module does not introduce workspace or auth behavior.
 */
@Global()
@Module({
  providers: [
    {
      provide: SUPABASE_CONFIG,
      useFactory: (): SupabaseConfig => resolveSupabaseConfig(),
    },
    {
      provide: SUPABASE_CLIENTS,
      useFactory: (config: SupabaseConfig): SupabaseClients | null => {
        if (!config.enabled) {
          return null;
        }
        return createSupabaseClients(config);
      },
      inject: [SUPABASE_CONFIG],
    },
    {
      provide: SUPABASE_ANON_CLIENT,
      useFactory: (clients: SupabaseClients | null): BadgerSupabaseClient | null =>
        clients?.anon ?? null,
      inject: [SUPABASE_CLIENTS],
    },
    {
      provide: SUPABASE_SERVICE_ROLE_CLIENT,
      useFactory: (clients: SupabaseClients | null): BadgerSupabaseClient | null =>
        clients?.serviceRole ?? null,
      inject: [SUPABASE_CLIENTS],
    },
    {
      provide: DATABASE_CLIENT,
      useFactory: (
        config: SupabaseConfig,
        serviceRole: BadgerSupabaseClient | null,
      ): DatabaseClient => {
        if (!config.enabled || serviceRole === null) {
          return new DisabledDatabaseClient();
        }
        return new SupabaseDatabaseClient(serviceRole);
      },
      inject: [SUPABASE_CONFIG, SUPABASE_SERVICE_ROLE_CLIENT],
    },
    DatabaseConnectivityService,
  ],
  exports: [
    SUPABASE_CONFIG,
    SUPABASE_ANON_CLIENT,
    SUPABASE_SERVICE_ROLE_CLIENT,
    DATABASE_CLIENT,
  ],
})
export class DatabaseModule {}
