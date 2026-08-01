/**
 * How long the CLI waits between reconnect attempts after an unexpected
 * disconnect.
 */
export const RECONNECT_INTERVAL_MS = 5_000;

/**
 * How long the server keeps a disconnected tunnel reclaimable.
 *
 * Sized to cover brief outages (sleep, Wi‑Fi blips) so reconnect can keep the
 * same public URL without forcing a new tunnel.
 */
export const TUNNEL_RECLAIM_WINDOW_MS = 600_000;
