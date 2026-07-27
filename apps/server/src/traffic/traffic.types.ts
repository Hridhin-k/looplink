import type { HttpHeaders, HttpMethod } from "@hridhin-k/badger-shared";

/**
 * A recorded HTTP exchange observed through the EventBus.
 */
export interface TrafficRecord {
  /** Correlated HTTP forward request id. */
  readonly requestId: string;
  /** Epoch ms when the request was received. */
  readonly timestamp: number;
  /** HTTP method. */
  readonly method: HttpMethod;
  /** Request path forwarded to the local app. */
  readonly path: string;
  /** Inbound request headers. */
  readonly headers: HttpHeaders;
  /** Raw request body (may be truncated by the store). */
  readonly body: Uint8Array;
  /** HTTP status when a response completed; `undefined` while pending/failed early. */
  readonly status: number | undefined;
  /** Response headers when a response completed. */
  readonly responseHeaders: HttpHeaders;
  /** Raw response body when a response completed (may be truncated). */
  readonly responseBody: Uint8Array;
  /** Round-trip latency in ms when a response completed. */
  readonly latencyMs: number | undefined;
  /** Tunnel that handled the exchange. */
  readonly tunnelId: string;
  /** Failure reason when the exchange failed. */
  readonly error: string | undefined;
}

/**
 * Mutable fields applied when updating an existing {@link TrafficRecord}.
 */
export interface TrafficRecordPatch {
  readonly status?: number;
  readonly responseHeaders?: HttpHeaders;
  readonly responseBody?: Uint8Array;
  readonly latencyMs?: number;
  readonly error?: string;
}

/**
 * Options for listing stored traffic records.
 */
export interface ListTrafficRecordsOptions {
  /** Maximum number of records to return (most recent first). */
  readonly limit?: number;
  /** When set, only records for this tunnel are returned. */
  readonly tunnelId?: string;
}
