/**
 * Disabled Supabase integration — tunnel and observability continue without a DB.
 */
export interface SupabaseConfigDisabled {
  readonly enabled: false;
}

/**
 * Enabled Supabase integration with validated connection credentials.
 */
export interface SupabaseConfigEnabled {
  readonly enabled: true;
  /** Project API URL (https://….supabase.co or local http://127.0.0.1:54321). */
  readonly url: string;
  /** Publishable / anon key for Auth and RLS-scoped access. */
  readonly anonKey: string;
  /** Service-role key for privileged server-side access. Never ship to clients. */
  readonly serviceRoleKey: string;
}

/**
 * Resolved Supabase configuration for the Badger server process.
 */
export type SupabaseConfig = SupabaseConfigDisabled | SupabaseConfigEnabled;

const ENV_URL = "SUPABASE_URL";
const ENV_ANON_KEY = "SUPABASE_ANON_KEY";
const ENV_SERVICE_ROLE_KEY = "SUPABASE_SERVICE_ROLE_KEY";

/**
 * Reads a trimmed environment value, or `undefined` when unset/blank.
 *
 * @param name - Env var name.
 * @returns Trimmed value, or `undefined`.
 */
function readOptionalEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (raw === undefined || raw.trim().length === 0) {
    return undefined;
  }
  return raw.trim();
}

/**
 * Validates that a string is an absolute http(s) URL.
 *
 * @param name - Env var name (for error messages).
 * @param value - Candidate URL.
 * @returns Normalized URL string (without trailing slash).
 */
function requireHttpUrl(name: string, value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Invalid ${name} "${value}": expected an absolute http(s) URL.`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Invalid ${name} "${value}": expected http: or https: protocol.`);
  }

  // Normalize trailing slash so client construction is consistent.
  return value.replace(/\/+$/u, "");
}

/**
 * Validates a non-empty API key string.
 *
 * @param name - Env var name (for error messages).
 * @param value - Candidate key.
 * @returns The trimmed key.
 */
function requireApiKey(name: string, value: string): string {
  if (value.length < 20) {
    throw new Error(`Invalid ${name}: expected a non-empty Supabase API key.`);
  }
  return value;
}

/**
 * Resolves Supabase configuration from the process environment.
 *
 * When none of the Supabase variables are set, integration is disabled so the
 * existing tunnel and dashboard keep working without a database.
 *
 * When any variable is set, all three are required and validated (fail-fast).
 *
 * @returns Immutable configuration snapshot.
 */
export function resolveSupabaseConfig(): SupabaseConfig {
  const url = readOptionalEnv(ENV_URL);
  const anonKey = readOptionalEnv(ENV_ANON_KEY);
  const serviceRoleKey = readOptionalEnv(ENV_SERVICE_ROLE_KEY);

  const anySet = url !== undefined || anonKey !== undefined || serviceRoleKey !== undefined;
  if (!anySet) {
    return { enabled: false };
  }

  if (url === undefined || anonKey === undefined || serviceRoleKey === undefined) {
    const missing = [
      url === undefined ? ENV_URL : undefined,
      anonKey === undefined ? ENV_ANON_KEY : undefined,
      serviceRoleKey === undefined ? ENV_SERVICE_ROLE_KEY : undefined,
    ].filter((name): name is string => name !== undefined);

    throw new Error(
      `Incomplete Supabase configuration: missing ${missing.join(", ")}. ` +
        `Set all of ${ENV_URL}, ${ENV_ANON_KEY}, and ${ENV_SERVICE_ROLE_KEY}, ` +
        `or unset them all to disable Supabase.`,
    );
  }

  return {
    enabled: true,
    url: requireHttpUrl(ENV_URL, url),
    anonKey: requireApiKey(ENV_ANON_KEY, anonKey),
    serviceRoleKey: requireApiKey(ENV_SERVICE_ROLE_KEY, serviceRoleKey),
  };
}
