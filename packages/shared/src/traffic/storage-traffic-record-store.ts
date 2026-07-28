import type { StorageProvider } from "../storage/storage-provider.js";
import {
  DEFAULT_MAX_RECORDED_BODY_BYTES,
  DEFAULT_MAX_TRAFFIC_RECORDS,
  TRAFFIC_ORDER_KEY,
  TRAFFIC_RECORD_KEY_PREFIX,
  TRAFFIC_STORAGE_NAMESPACE,
} from "./constants.js";
import { EMPTY_TRAFFIC_BODY, capTrafficBody } from "./traffic-body.js";
import type { TrafficRecordStore } from "./traffic-record-store.js";
import type {
  ListTrafficRecordsOptions,
  TrafficRecord,
  TrafficRecordPatch,
} from "./traffic-record.js";

/**
 * Options for {@link StorageTrafficRecordStore}.
 */
export interface StorageTrafficRecordStoreOptions {
  /** Maximum retained records. Oldest entries are evicted first. */
  readonly maxRecords?: number;
  /** Maximum body bytes retained per request/response body. */
  readonly maxBodyBytes?: number;
}

/**
 * {@link TrafficRecordStore} backed by a {@link StorageProvider}.
 *
 * Records live under the `traffic` namespace. An ordered index key tracks
 * insertion order for newest-first listing and FIFO eviction. Bodies are
 * capped so large payloads never dominate process memory.
 */
export class StorageTrafficRecordStore implements TrafficRecordStore {
  private readonly maxRecords: number;
  private readonly maxBodyBytes: number;

  /**
   * @param storage - Backend-agnostic key/value store.
   * @param options - Retention and body size limits.
   */
  constructor(
    private readonly storage: StorageProvider,
    options: StorageTrafficRecordStoreOptions = {},
  ) {
    this.maxRecords = options.maxRecords ?? DEFAULT_MAX_TRAFFIC_RECORDS;
    this.maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_RECORDED_BODY_BYTES;
  }

  /**
   * @inheritdoc
   */
  async save(record: TrafficRecord): Promise<void> {
    const normalized = this.normalize(record);
    const key = recordKey(normalized.requestId);
    const existing = await this.storage.get<TrafficRecord>(TRAFFIC_STORAGE_NAMESPACE, key);

    await this.storage.save(TRAFFIC_STORAGE_NAMESPACE, key, normalized);

    if (existing !== undefined) {
      return;
    }

    const order = await this.readOrder();
    order.push(normalized.requestId);
    await this.evictOverflow(order);
    await this.writeOrder(order);
  }

  /**
   * @inheritdoc
   */
  async update(requestId: string, patch: TrafficRecordPatch): Promise<TrafficRecord | undefined> {
    const key = recordKey(requestId);
    const existing = await this.storage.get<TrafficRecord>(TRAFFIC_STORAGE_NAMESPACE, key);
    if (existing === undefined) {
      return undefined;
    }

    const updated: TrafficRecord = {
      ...existing,
      ...(patch.status === undefined ? {} : { status: patch.status }),
      ...(patch.responseHeaders === undefined ? {} : { responseHeaders: patch.responseHeaders }),
      ...(patch.responseBody === undefined
        ? {}
        : { responseBody: capTrafficBody(patch.responseBody, this.maxBodyBytes) }),
      ...(patch.latencyMs === undefined ? {} : { latencyMs: patch.latencyMs }),
      ...(patch.error === undefined ? {} : { error: patch.error }),
    };

    await this.storage.save(TRAFFIC_STORAGE_NAMESPACE, key, updated);
    return updated;
  }

  /**
   * @inheritdoc
   */
  async findById(requestId: string): Promise<TrafficRecord | undefined> {
    return this.storage.get<TrafficRecord>(TRAFFIC_STORAGE_NAMESPACE, recordKey(requestId));
  }

  /**
   * @inheritdoc
   */
  async list(options: ListTrafficRecordsOptions = {}): Promise<readonly TrafficRecord[]> {
    const order = await this.readOrder();
    const tunnelId = options.tunnelId;
    const includeBodies = options.includeBodies !== false;
    const collected: TrafficRecord[] = [];

    for (let index = order.length - 1; index >= 0; index -= 1) {
      const id = order[index];
      if (id === undefined) {
        continue;
      }

      const record = await this.storage.get<TrafficRecord>(
        TRAFFIC_STORAGE_NAMESPACE,
        recordKey(id),
      );
      if (record === undefined) {
        continue;
      }

      if (tunnelId !== undefined && record.tunnelId !== tunnelId) {
        continue;
      }

      collected.push(includeBodies ? record : stripBodies(record));

      if (options.limit !== undefined && collected.length >= options.limit) {
        break;
      }
    }

    return collected;
  }

  /**
   * @inheritdoc
   */
  async clear(): Promise<void> {
    await this.storage.clear(TRAFFIC_STORAGE_NAMESPACE);
  }

  /**
   * @inheritdoc
   */
  async size(): Promise<number> {
    const order = await this.readOrder();
    return order.length;
  }

  private normalize(record: TrafficRecord): TrafficRecord {
    return {
      ...record,
      body: capTrafficBody(record.body, this.maxBodyBytes),
      responseBody: capTrafficBody(record.responseBody, this.maxBodyBytes),
    };
  }

  private async readOrder(): Promise<string[]> {
    const order = await this.storage.get<string[]>(TRAFFIC_STORAGE_NAMESPACE, TRAFFIC_ORDER_KEY);
    return order === undefined ? [] : [...order];
  }

  private async writeOrder(order: string[]): Promise<void> {
    await this.storage.save(TRAFFIC_STORAGE_NAMESPACE, TRAFFIC_ORDER_KEY, order);
  }

  private async evictOverflow(order: string[]): Promise<void> {
    while (order.length > this.maxRecords) {
      const oldest = order.shift();
      if (oldest === undefined) {
        return;
      }

      await this.storage.delete(TRAFFIC_STORAGE_NAMESPACE, recordKey(oldest));
    }
  }
}

/**
 * Builds the storage key for a request id.
 *
 * @param requestId - HTTP request correlation id.
 * @returns Namespaced record key.
 */
function recordKey(requestId: string): string {
  return `${TRAFFIC_RECORD_KEY_PREFIX}${requestId}`;
}

/**
 * Returns a copy with body payloads cleared while preserving size metadata.
 *
 * @param record - Full traffic record.
 * @returns Record safe for lightweight list views.
 */
function stripBodies(record: TrafficRecord): TrafficRecord {
  return {
    ...record,
    body: {
      byteLength: record.body.byteLength,
      truncated: record.body.truncated,
      dataBase64: EMPTY_TRAFFIC_BODY.dataBase64,
    },
    responseBody: {
      byteLength: record.responseBody.byteLength,
      truncated: record.responseBody.truncated,
      dataBase64: EMPTY_TRAFFIC_BODY.dataBase64,
    },
  };
}
