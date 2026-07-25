/**
 * Default TCP port the LoopLink server listens on when `PORT` is unset.
 */
export const DEFAULT_SERVER_PORT = 8080;

/**
 * Default host binding. `0.0.0.0` keeps Fastify and the WebSocket upgrade on the
 * same HTTP server (Fastify's `localhost` dual-stack binding breaks WS upgrades).
 */
export const DEFAULT_SERVER_HOST = "0.0.0.0";

/**
 * Resolves the listen port from the environment.
 *
 * @returns A TCP port in the range 1–65535.
 */
export function resolveServerPort(): number {
  const raw = process.env["PORT"];

  if (raw === undefined || raw.trim().length === 0) {
    return DEFAULT_SERVER_PORT;
  }

  const port = Number(raw);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Invalid PORT "${raw}": expected an integer between 1 and 65535.`);
  }

  return port;
}

/**
 * Resolves the listen host from the environment.
 *
 * @returns A host string suitable for Fastify's `listen`.
 */
export function resolveServerHost(): string {
  const raw = process.env["HOST"];

  if (raw === undefined || raw.trim().length === 0) {
    return DEFAULT_SERVER_HOST;
  }

  return raw;
}
