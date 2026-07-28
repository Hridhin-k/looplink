import { Global, Module } from "@nestjs/common";

import { createStorageProvider, STORAGE_PROVIDER } from "@hridhin-k/badger-shared";

/**
 * Provides a process-wide {@link import("@hridhin-k/badger-shared").StorageProvider}.
 *
 * Defaults to the in-memory backend. Application services must inject
 * `STORAGE_PROVIDER` and must not depend on {@link import("@hridhin-k/badger-shared").MemoryStorage}
 * directly so backends can be swapped at the composition root.
 */
@Global()
@Module({
  providers: [
    {
      provide: STORAGE_PROVIDER,
      useFactory: () => createStorageProvider({ backend: "memory" }),
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
