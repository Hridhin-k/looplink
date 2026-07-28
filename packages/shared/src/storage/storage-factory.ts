import { MemoryStorage } from "./memory-storage.js";
import type { StorageBackendKind, StorageProvider } from "./storage-provider.js";

/**
 * Configuration for {@link StorageFactory} / {@link createStorageProvider}.
 *
 * Additional connection fields will be added per backend without changing the
 * {@link StorageProvider} consumer API.
 */
export interface StorageFactoryOptions {
  /**
   * Backend to construct. Defaults to `"memory"`.
   *
   * Unimplemented backends throw a clear error so misconfiguration fails fast.
   */
  readonly backend?: StorageBackendKind;
}

/**
 * Creates a {@link StorageProvider} for the requested backend.
 *
 * Prefer injecting {@link StorageProvider} (via {@link STORAGE_PROVIDER}) into
 * application code. Call this factory only from composition roots.
 *
 * @param options - Backend selection and future connection settings.
 * @returns A ready-to-use provider instance.
 */
export function createStorageProvider(options: StorageFactoryOptions = {}): StorageProvider {
  const backend = options.backend ?? "memory";

  switch (backend) {
    case "memory":
      return new MemoryStorage();
    case "sqlite":
    case "postgres":
    case "redis":
    case "s3":
      throw new Error(
        `Storage backend "${backend}" is reserved but not implemented yet. Use backend: "memory".`,
      );
    default: {
      const exhaustive: never = backend;
      throw new Error(`Unknown storage backend: ${String(exhaustive)}`);
    }
  }
}

/**
 * Factory used by composition roots and dependency injection.
 *
 * Application modules should receive a {@link StorageProvider}, not this class,
 * so they remain unaware of which backend is active.
 */
export class StorageFactory {
  /**
   * Creates a provider for the given options.
   *
   * @param options - Backend selection.
   * @returns A {@link StorageProvider} instance.
   */
  create(options: StorageFactoryOptions = {}): StorageProvider {
    return createStorageProvider(options);
  }
}
