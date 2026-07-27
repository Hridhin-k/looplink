/**
 * Default WebSocket URL for the hosted Badger server.
 *
 * Override with `--server` or {@link SERVER_URL_ENV} for local development.
 */
export const DEFAULT_SERVER_URL = "wss://looplinkserver-production.up.railway.app";

/**
 * Environment variable that overrides {@link DEFAULT_SERVER_URL}.
 */
export const SERVER_URL_ENV = "BADGER_SERVER_URL";

/**
 * Resolves the Badger server WebSocket URL.
 *
 * Precedence: explicit CLI override → {@link SERVER_URL_ENV} → {@link DEFAULT_SERVER_URL}.
 *
 * @param override - Optional URL from a CLI flag.
 * @returns The WebSocket URL to connect to.
 */
export function resolveServerUrl(override?: string): string {
  if (override !== undefined && override.trim().length > 0) {
    return override.trim();
  }

  const fromEnv = process.env[SERVER_URL_ENV];

  if (fromEnv !== undefined && fromEnv.trim().length > 0) {
    return fromEnv.trim();
  }

  return DEFAULT_SERVER_URL;
}
