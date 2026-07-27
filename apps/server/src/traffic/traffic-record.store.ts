import type {
  ListTrafficRecordsOptions,
  TrafficRecord,
  TrafficRecordPatch,
} from "./traffic.types.js";

/**
 * Persistence port for recorded HTTP traffic.
 *
 * The default implementation is in-memory. Future adapters (SQLite, Redis, …)
 * can replace it without changing {@link import("./traffic-recorder.service.js").TrafficRecorderService}.
 */
export interface TrafficRecordStore {
  /**
   * Inserts a new record. Replaces any existing record with the same request id.
   *
   * @param record - Traffic record to persist.
   */
  save(record: TrafficRecord): void;

  /**
   * Applies a patch to an existing record.
   *
   * @param requestId - Record key.
   * @param patch - Fields to overwrite.
   * @returns The updated record, or `undefined` when no record exists.
   */
  update(requestId: string, patch: TrafficRecordPatch): TrafficRecord | undefined;

  /**
   * Looks up a record by request id.
   *
   * @param requestId - Record key.
   * @returns The matching record, or `undefined` when absent.
   */
  findById(requestId: string): TrafficRecord | undefined;

  /**
   * Lists records, newest first.
   *
   * @param options - Optional limit and tunnel filter.
   * @returns Matching records in reverse chronological order.
   */
  list(options?: ListTrafficRecordsOptions): readonly TrafficRecord[];

  /**
   * Removes every stored record.
   */
  clear(): void;

  /**
   * @returns Number of currently stored records.
   */
  size(): number;
}
