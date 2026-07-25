/**
 * How often a connected CLI sends a `PING` keepalive to the server.
 */
export const HEARTBEAT_INTERVAL_MS = 30_000;

/**
 * How long the server tolerates silence before disconnecting a client.
 *
 * Deliberately 2× {@link HEARTBEAT_INTERVAL_MS} so a single lost or delayed
 * ping does not tear down an otherwise healthy connection.
 */
export const HEARTBEAT_TIMEOUT_MS = 60_000;
