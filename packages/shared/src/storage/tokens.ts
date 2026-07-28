/**
 * Injection token for {@link import("./storage-provider.js").StorageProvider}.
 *
 * Frameworks (NestJS) and manual composition roots bind this symbol to the
 * instance produced by {@link import("./storage-factory.js").createStorageProvider}.
 */
export const STORAGE_PROVIDER = Symbol.for("badger.StorageProvider");
