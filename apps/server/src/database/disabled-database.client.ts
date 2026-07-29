import type { DatabaseClient } from "./database-client.js";

/**
 * No-op {@link DatabaseClient} used when Supabase env vars are unset.
 *
 * Keeps DI wiring intact so tunnel/observability modules boot unchanged.
 * Callers that require a live database must check {@link import("./supabase.config.js").SupabaseConfig}
 * or catch the error from {@link ping}.
 */
export class DisabledDatabaseClient implements DatabaseClient {
  /**
   * Always fails — there is no configured data store.
   */
  ping(): Promise<void> {
    return Promise.reject(
      new Error(
        "Supabase is not configured. Set SUPABASE_URL, SUPABASE_ANON_KEY, and " +
          "SUPABASE_SERVICE_ROLE_KEY to enable the database client.",
      ),
    );
  }
}
