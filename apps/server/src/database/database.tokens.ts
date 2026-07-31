/**
 * Injection token for the resolved {@link import("./supabase.config.js").SupabaseConfig}.
 */
export const SUPABASE_CONFIG = Symbol("SUPABASE_CONFIG");

/**
 * Injection token for the anon-key Supabase JS client.
 *
 * Bound only when Supabase is enabled. Used for user-scoped Auth operations.
 */
export const SUPABASE_ANON_CLIENT = Symbol("SUPABASE_ANON_CLIENT");

/**
 * Injection token for the service-role Supabase JS client.
 *
 * Bound only when Supabase is enabled. Server-side privileged access only —
 * never expose this client or its key to the dashboard or CLI.
 */
export const SUPABASE_SERVICE_ROLE_CLIENT = Symbol("SUPABASE_SERVICE_ROLE_CLIENT");

/**
 * Injection token for the database-agnostic {@link import("./database-client.js").DatabaseClient}.
 */
export const DATABASE_CLIENT = Symbol("DATABASE_CLIENT");
