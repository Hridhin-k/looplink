import type { HttpHeaders, HttpMethod, HttpQuery } from "../types/http-forwarding.js";
import type { TrafficBody } from "./traffic-body.js";

/**
 * A recorded HTTP exchange observed through the EventBus.
 *
 * Values are JSON-serializable so any {@link import("../storage/storage-provider.js").StorageProvider}
 * backend can persist them.
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
  /** Parsed query-string parameters. */
  readonly query: HttpQuery;
  /** Request body snapshot (may be truncated). */
  readonly body: TrafficBody;
  /** HTTP status when a response completed; `undefined` while pending/failed early. */
  readonly status: number | undefined;
  /** Response headers when a response completed. */
  readonly responseHeaders: HttpHeaders;
  /** Response body snapshot when a response completed (may be truncated). */
  readonly responseBody: TrafficBody;
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
  readonly responseBody?: TrafficBody;
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
  /**
   * When `false`, returned records use empty body snapshots while preserving
   * {@link TrafficBody.byteLength} / {@link TrafficBody.truncated} metadata.
   * Useful for list UIs that should not decode large payloads.
   *
   * @defaultValue true
   */
  readonly includeBodies?: boolean;
}
