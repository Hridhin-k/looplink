/**
 * Public endpoints the dashboard uses to reach the Badger tunnel server.
 *
 * The dashboard must never import server internals. All traffic goes through
 * these configured public REST and WebSocket base URLs.
 */
export interface DashboardServerConfig {
  /** HTTP origin of the Badger server (no trailing slash). */
  readonly apiBaseUrl: string;
  /** WebSocket origin of the Badger server (no trailing slash). */
  readonly wsBaseUrl: string;
}

/** Default local development HTTP origin for the Badger server. */
export const DEFAULT_BADGER_API_URL = "http://localhost:8080";

/** Default local development WebSocket origin for the Badger server. */
export const DEFAULT_BADGER_WS_URL = "ws://localhost:8080";

/**
 * Reads dashboard → server connection settings from the environment.
 *
 * Uses `NEXT_PUBLIC_*` variables so the same values are available in the
 * browser bundle. Missing values fall back to local development defaults.
 *
 * @param env - Environment map. Defaults to `process.env`.
 * @returns Normalized API and WebSocket base URLs.
 */
export function resolveDashboardServerConfig(
  env: NodeJS.ProcessEnv = process.env,
): DashboardServerConfig {
  return {
    apiBaseUrl: normalizeBaseUrl(env["NEXT_PUBLIC_BADGER_API_URL"], DEFAULT_BADGER_API_URL),
    wsBaseUrl: normalizeBaseUrl(env["NEXT_PUBLIC_BADGER_WS_URL"], DEFAULT_BADGER_WS_URL),
  };
}

/**
 * Trims whitespace and removes a trailing slash from a base URL.
 *
 * @param value - Raw env value.
 * @param fallback - Value used when `value` is empty or unset.
 * @returns A normalized base URL.
 */
function normalizeBaseUrl(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  if (trimmed === undefined || trimmed.length === 0) {
    return fallback;
  }

  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}
