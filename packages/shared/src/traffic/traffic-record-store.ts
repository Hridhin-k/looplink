import type {
  ListTrafficRecordsOptions,
  TrafficRecord,
  TrafficRecordPatch,
} from "./traffic-record.js";

/**
 * Persistence port for recorded HTTP traffic.
 *
 * Implementations must store through a
 * {@link import("../storage/storage-provider.js").StorageProvider} (or an
 * equivalent backend). Callers must not depend on a concrete store class.
 */
export interface TrafficRecordStore {
  /**
   * Inserts a new record. Replaces any existing record with the same request id.
   *
   * @param record - Traffic record to persist.
   */
  save(record: TrafficRecord): Promise<void>;

  /**
   * Applies a patch to an existing record.
   *
   * @param requestId - Record key.
   * @param patch - Fields to overwrite.
   * @returns The updated record, or `undefined` when no record exists.
   */
  update(requestId: string, patch: TrafficRecordPatch): Promise<TrafficRecord | undefined>;

  /**
   * Looks up a record by request id.
   *
   * @param requestId - Record key.
   * @returns The matching record, or `undefined` when absent.
   */
  findById(requestId: string): Promise<TrafficRecord | undefined>;

  /**
   * Lists records, newest first.
   *
   * @param options - Optional limit, tunnel filter, and body inclusion.
   * @returns Matching records in reverse chronological order.
   */
  list(options?: ListTrafficRecordsOptions): Promise<readonly TrafficRecord[]>;

  /**
   * Removes every stored record in the traffic namespace.
   */
  clear(): Promise<void>;

  /**
   * @returns Number of currently stored records.
   */
  size(): Promise<number>;
}
