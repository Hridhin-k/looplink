import type { StorageListOptions, StorageProvider } from "./storage-provider.js";
import { assertStorageSegment } from "./storage-path.js";

/**
 * In-process {@link StorageProvider} with no external dependencies.
 *
 * Suitable for local development, tests, and single-replica deployments.
 * Values are deep-cloned on {@link save} / {@link get} so callers cannot mutate
 * the store through retained references.
 */
export class MemoryStorage implements StorageProvider {
  private readonly namespaces = new Map<string, Map<string, unknown>>();

  /**
   * @inheritdoc
   */
  save(namespace: string, key: string, value: unknown): Promise<void> {
    try {
      const ns = assertStorageSegment("namespace", namespace);
      const k = assertStorageSegment("key", key);
      const bucket = this.getOrCreateNamespace(ns);
      bucket.set(k, cloneValue(value));
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * @inheritdoc
   */
  get<T>(namespace: string, key: string): Promise<T | undefined> {
    try {
      const ns = assertStorageSegment("namespace", namespace);
      const k = assertStorageSegment("key", key);
      const bucket = this.namespaces.get(ns);
      if (!bucket?.has(k)) {
        return Promise.resolve(undefined);
      }

      return Promise.resolve(cloneValue(bucket.get(k)) as T);
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * @inheritdoc
   */
  list(namespace: string, options: StorageListOptions = {}): Promise<string[]> {
    try {
      const ns = assertStorageSegment("namespace", namespace);
      const bucket = this.namespaces.get(ns);
      if (bucket === undefined) {
        return Promise.resolve([]);
      }

      let keys = [...bucket.keys()].sort();
      const prefix = options.prefix;
      if (prefix !== undefined && prefix.length > 0) {
        keys = keys.filter((key) => key.startsWith(prefix));
      }

      const limit = options.limit;
      if (limit !== undefined) {
        if (!Number.isInteger(limit) || limit < 0) {
          throw new Error(
            `Storage list limit must be a non-negative integer, received ${String(limit)}.`,
          );
        }
        keys = keys.slice(0, limit);
      }

      return Promise.resolve(keys);
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * @inheritdoc
   */
  delete(namespace: string, key: string): Promise<boolean> {
    try {
      const ns = assertStorageSegment("namespace", namespace);
      const k = assertStorageSegment("key", key);
      const bucket = this.namespaces.get(ns);
      if (bucket === undefined) {
        return Promise.resolve(false);
      }

      const removed = bucket.delete(k);
      if (bucket.size === 0) {
        this.namespaces.delete(ns);
      }

      return Promise.resolve(removed);
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * @inheritdoc
   */
  clear(namespace?: string): Promise<void> {
    try {
      if (namespace === undefined) {
        this.namespaces.clear();
        return Promise.resolve();
      }

      const ns = assertStorageSegment("namespace", namespace);
      this.namespaces.delete(ns);
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private getOrCreateNamespace(namespace: string): Map<string, unknown> {
    let bucket = this.namespaces.get(namespace);
    if (bucket === undefined) {
      bucket = new Map();
      this.namespaces.set(namespace, bucket);
    }

    return bucket;
  }
}

/**
 * Deep-clones a JSON-compatible value.
 *
 * @param value - Value to clone.
 * @returns Independent copy.
 */
function cloneValue<T>(value: T): T {
  return structuredClone(value);
}
