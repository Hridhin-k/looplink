/**
 * Supported storage backend identifiers.
 *
 * Only {@link MemoryStorage} is implemented today. Other values are reserved so
 * {@link import("./storage-factory.js").StorageFactory} can grow without
 * changing consumer call sites.
 */
export type StorageBackendKind = "memory" | "sqlite" | "postgres" | "redis" | "s3";

/**
 * Options for {@link StorageProvider.list}.
 */
export interface StorageListOptions {
  /** When set, only keys that start with this prefix are returned. */
  readonly prefix?: string;
  /** Maximum number of keys to return (implementation-defined order). */
  readonly limit?: number;
}

/**
 * Backend-agnostic key/value store scoped by namespace.
 *
 * Consumers must depend only on this interface. They must not inspect or branch
 * on the concrete backend (memory, SQLite, PostgreSQL, Redis, S3, …).
 *
 * Values should be JSON-serializable plain data so future remote backends can
 * persist them without custom serializers in business logic.
 */
export interface StorageProvider {
  /**
   * Persists `value` under `namespace`/`key`, replacing any previous value.
   *
   * @param namespace - Logical partition (for example `traffic` or `tunnels`).
   * @param key - Unique key within the namespace.
   * @param value - JSON-serializable value to store.
   */
  save(namespace: string, key: string, value: unknown): Promise<void>;

  /**
   * Reads a previously saved value.
   *
   * @typeParam T - Expected value type.
   * @param namespace - Logical partition.
   * @param key - Key within the namespace.
   * @returns The value, or `undefined` when missing.
   */
  get<T>(namespace: string, key: string): Promise<T | undefined>;

  /**
   * Lists keys in a namespace.
   *
   * @param namespace - Logical partition.
   * @param options - Optional prefix filter and limit.
   * @returns Matching keys (sorted ascending for deterministic tests).
   */
  list(namespace: string, options?: StorageListOptions): Promise<string[]>;

  /**
   * Removes a single key.
   *
   * @param namespace - Logical partition.
   * @param key - Key within the namespace.
   * @returns `true` when a value was removed, `false` when missing.
   */
  delete(namespace: string, key: string): Promise<boolean>;

  /**
   * Removes stored data.
   *
   * @param namespace - When provided, clears only that namespace; when omitted,
   *   clears every namespace in this provider instance.
   */
  clear(namespace?: string): Promise<void>;
}
