/**
 * Default ceiling on retained traffic records (oldest evicted first).
 */
export const DEFAULT_MAX_TRAFFIC_RECORDS = 1_000;

/**
 * Default ceiling on stored request/response body bytes per side.
 *
 * Larger payloads are truncated; {@link import("./traffic-body.js").TrafficBody.byteLength}
 * still reports the original size.
 */
export const DEFAULT_MAX_RECORDED_BODY_BYTES = 65_536;

/**
 * {@link import("../storage/storage-provider.js").StorageProvider} namespace for
 * traffic records and the insertion-order index.
 */
export const TRAFFIC_STORAGE_NAMESPACE = "traffic";

/**
 * Storage key holding the ordered list of request ids (newest at the end).
 */
export const TRAFFIC_ORDER_KEY = "__order__";

/**
 * Prefix for per-request traffic record keys.
 */
export const TRAFFIC_RECORD_KEY_PREFIX = "r:";
