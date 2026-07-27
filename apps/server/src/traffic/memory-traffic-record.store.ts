import {
  DEFAULT_MAX_RECORDED_BODY_BYTES,
  DEFAULT_MAX_TRAFFIC_RECORDS,
} from "./traffic.constants.js";
import type { TrafficRecordStore } from "./traffic-record.store.js";
import type {
  ListTrafficRecordsOptions,
  TrafficRecord,
  TrafficRecordPatch,
} from "./traffic.types.js";

/**
 * Options for {@link MemoryTrafficRecordStore}.
 */
export interface MemoryTrafficRecordStoreOptions {
  /** Maximum retained records. Oldest entries are evicted first. */
  readonly maxRecords?: number;
  /** Maximum body bytes retained per request/response body. */
  readonly maxBodyBytes?: number;
}

/**
 * In-memory {@link TrafficRecordStore} with bounded retention.
 */
export class MemoryTrafficRecordStore implements TrafficRecordStore {
  private readonly records = new Map<string, TrafficRecord>();
  private readonly order: string[] = [];
  private readonly maxRecords: number;
  private readonly maxBodyBytes: number;

  /**
   * @param options - Retention limits.
   */
  constructor(options: MemoryTrafficRecordStoreOptions = {}) {
    this.maxRecords = options.maxRecords ?? DEFAULT_MAX_TRAFFIC_RECORDS;
    this.maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_RECORDED_BODY_BYTES;
  }

  /**
   * Inserts a new record, truncating bodies and evicting oldest entries as needed.
   *
   * @param record - Traffic record to persist.
   */
  save(record: TrafficRecord): void {
    const normalized: TrafficRecord = {
      ...record,
      body: truncateBody(record.body, this.maxBodyBytes),
      responseBody: truncateBody(record.responseBody, this.maxBodyBytes),
    };

    if (this.records.has(normalized.requestId)) {
      this.records.set(normalized.requestId, normalized);
      return;
    }

    this.records.set(normalized.requestId, normalized);
    this.order.push(normalized.requestId);
    this.evictOverflow();
  }

  /**
   * Applies a patch to an existing record.
   *
   * @param requestId - Record key.
   * @param patch - Fields to overwrite.
   * @returns The updated record, or `undefined` when no record exists.
   */
  update(requestId: string, patch: TrafficRecordPatch): TrafficRecord | undefined {
    const existing = this.records.get(requestId);
    if (existing === undefined) {
      return undefined;
    }

    const updated: TrafficRecord = {
      ...existing,
      ...(patch.status === undefined ? {} : { status: patch.status }),
      ...(patch.responseHeaders === undefined ? {} : { responseHeaders: patch.responseHeaders }),
      ...(patch.responseBody === undefined
        ? {}
        : { responseBody: truncateBody(patch.responseBody, this.maxBodyBytes) }),
      ...(patch.latencyMs === undefined ? {} : { latencyMs: patch.latencyMs }),
      ...(patch.error === undefined ? {} : { error: patch.error }),
    };

    this.records.set(requestId, updated);
    return updated;
  }

  /**
   * Looks up a record by request id.
   *
   * @param requestId - Record key.
   * @returns The matching record, or `undefined` when absent.
   */
  findById(requestId: string): TrafficRecord | undefined {
    return this.records.get(requestId);
  }

  /**
   * Lists records, newest first.
   *
   * @param options - Optional limit and tunnel filter.
   * @returns Matching records in reverse chronological order.
   */
  list(options: ListTrafficRecordsOptions = {}): readonly TrafficRecord[] {
    const tunnelId = options.tunnelId;
    const collected: TrafficRecord[] = [];

    for (let index = this.order.length - 1; index >= 0; index -= 1) {
      const id = this.order[index];
      if (id === undefined) {
        continue;
      }

      const record = this.records.get(id);
      if (record === undefined) {
        continue;
      }

      if (tunnelId !== undefined && record.tunnelId !== tunnelId) {
        continue;
      }

      collected.push(record);

      if (options.limit !== undefined && collected.length >= options.limit) {
        break;
      }
    }

    return collected;
  }

  /**
   * Removes every stored record.
   */
  clear(): void {
    this.records.clear();
    this.order.length = 0;
  }

  /**
   * @returns Number of currently stored records.
   */
  size(): number {
    return this.records.size;
  }

  private evictOverflow(): void {
    while (this.order.length > this.maxRecords) {
      const oldest = this.order.shift();
      if (oldest === undefined) {
        return;
      }
      this.records.delete(oldest);
    }
  }
}

/**
 * Returns a copy of `body` truncated to `maxBytes`.
 *
 * @param body - Source bytes.
 * @param maxBytes - Inclusive maximum length.
 * @returns Truncated (or original) body.
 */
function truncateBody(body: Uint8Array, maxBytes: number): Uint8Array {
  if (body.byteLength <= maxBytes) {
    return body;
  }

  return body.slice(0, maxBytes);
}
