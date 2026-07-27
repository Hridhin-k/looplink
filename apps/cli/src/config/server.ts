import { resolveEnvPreferringBadger } from "@badger/shared";

/**
 * Default WebSocket URL for the hosted Badger server.
 *
 * Override with `--server`, {@link SERVER_URL_ENV}, or the deprecated
 * {@link LEGACY_SERVER_URL_ENV} for local development.
 */
export const DEFAULT_SERVER_URL = "wss://looplinkserver-production.up.railway.app";

/**
 * Canonical environment variable that overrides {@link DEFAULT_SERVER_URL}.
 */
export const SERVER_URL_ENV = "BADGER_SERVER_URL";

/**
 * Deprecated LoopLink alias for {@link SERVER_URL_ENV}.
 *
 * Still honored for one release; prefer {@link SERVER_URL_ENV}.
 */
export const LEGACY_SERVER_URL_ENV = "LOOPLINK_SERVER_URL";

/**
 * Resolves the Badger server WebSocket URL.
 *
 * Precedence: explicit CLI override → `BADGER_SERVER_URL` →
 * `LOOPLINK_SERVER_URL` (deprecated) → {@link DEFAULT_SERVER_URL}.
 *
 * @param override - Optional URL from a CLI flag.
 * @returns The WebSocket URL to connect to.
 */
export function resolveServerUrl(override?: string): string {
  if (override !== undefined && override.trim().length > 0) {
    return override.trim();
  }

  const fromEnv = resolveEnvPreferringBadger(SERVER_URL_ENV, LEGACY_SERVER_URL_ENV);
  if (fromEnv !== undefined) {
    return fromEnv;
  }

  return DEFAULT_SERVER_URL;
}
