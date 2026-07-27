/**
 * Injection token for {@link import("./traffic-record.store.js").TrafficRecordStore}.
 */
export const TRAFFIC_RECORD_STORE = Symbol("TRAFFIC_RECORD_STORE");

/** Default ceiling on retained traffic records. */
export const DEFAULT_MAX_TRAFFIC_RECORDS = 1_000;

/** Default ceiling on stored request/response body bytes per record. */
export const DEFAULT_MAX_RECORDED_BODY_BYTES = 65_536;
