import { createClient } from "@supabase/supabase-js";

import type { SupabaseConfigEnabled } from "./supabase.config.js";

/**
 * Supabase JS client type used by Badger server infrastructure.
 */
export type BadgerSupabaseClient = ReturnType<typeof createClient>;

/**
 * Pair of Supabase JS clients for a single project.
 */
export interface SupabaseClients {
  /** Anon-key client for Auth and RLS-scoped operations. */
  readonly anon: BadgerSupabaseClient;
  /** Service-role client for privileged server-side operations. */
  readonly serviceRole: BadgerSupabaseClient;
}

/**
 * Builds anon and service-role Supabase clients from validated config.
 *
 * Auth session persistence is disabled — the Nest server is stateless and
 * validates JWTs per request rather than storing browser sessions.
 *
 * @param config - Enabled Supabase configuration.
 * @returns Client pair.
 */
export function createSupabaseClients(config: SupabaseConfigEnabled): SupabaseClients {
  const sharedOptions = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  } as const;

  return {
    anon: createClient(config.url, config.anonKey, sharedOptions),
    serviceRole: createClient(config.url, config.serviceRoleKey, sharedOptions),
  };
}
