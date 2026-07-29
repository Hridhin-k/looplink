import type { BadgerSupabaseClient } from "./create-supabase-clients.js";
import type { DatabaseClient } from "./database-client.js";

/**
 * {@link DatabaseClient} backed by a Supabase service-role client.
 *
 * Connectivity is verified via Auth health rather than a domain table query
 * so Phase 3.1 works before any SaaS schema exists.
 */
export class SupabaseDatabaseClient implements DatabaseClient {
  /**
   * @param client - Privileged Supabase client used for infrastructure checks.
   */
  constructor(private readonly client: BadgerSupabaseClient) {}

  /**
   * Confirms the Supabase project accepts the configured credentials.
   *
   * Uses `auth.getSession()` against the service-role client: a network or
   * credential failure surfaces as an error; success (including an empty
   * session) proves the API is reachable.
   */
  async ping(): Promise<void> {
    const { error } = await this.client.auth.getSession();
    if (error !== null) {
      throw new Error(`Supabase connectivity check failed: ${error.message}`);
    }
  }
}
