/**
 * How long the CLI waits between reconnect attempts after an unexpected
 * disconnect.
 */
export const RECONNECT_INTERVAL_MS = 5_000;

/**
 * How long the server keeps a disconnected tunnel reclaimable.
 *
 * Sized to cover several reconnect attempts so a brief network blip does not
 * force a new public URL.
 */
export const TUNNEL_RECLAIM_WINDOW_MS = 60_000;
