/**
 * Default WebSocket URL for a locally running LoopLink server.
 */
export const DEFAULT_SERVER_URL = "ws://127.0.0.1:8080";

/**
 * Environment variable that overrides {@link DEFAULT_SERVER_URL}.
 */
export const SERVER_URL_ENV = "LOOPLINK_SERVER_URL";

/**
 * Resolves the LoopLink server WebSocket URL.
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
