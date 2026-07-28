# Badger Storage Abstraction

Backend-agnostic key/value storage for Phase 2 modules (traffic records,
projections, caches). Application code depends only on
{@link StorageProvider} and never on a concrete database or cloud SDK.

## Architecture

```text
Composition root (StorageModule / StorageFactory)
        │
        │ createStorageProvider({ backend })
        ▼
   StorageProvider  ◀─── services inject STORAGE_PROVIDER
        │
        ├── MemoryStorage     (implemented)
        ├── SQLite            (reserved)
        ├── PostgreSQL        (reserved)
        ├── Redis             (reserved)
        └── S3                (reserved)
```

**Inversion of control:** business modules call `save` / `get` / `list` /
`delete` / `clear`. They do not import `MemoryStorage` or know which backend
the factory selected.

**Namespaces** partition data (for example `traffic`, `sessions`) so multiple
features share one provider without key collisions.

## Folder structure

```text
packages/shared/src/storage/
  storage-provider.ts     # StorageProvider interface
  memory-storage.ts       # In-memory implementation
  storage-factory.ts      # StorageFactory + createStorageProvider
  storage-path.ts         # namespace/key validation
  tokens.ts               # STORAGE_PROVIDER symbol
  index.ts
  memory-storage.spec.ts

apps/server/src/storage/
  storage.module.ts       # Nest @Global() provider (memory default)
```

## Interface

```ts
interface StorageProvider {
  save<T>(namespace: string, key: string, value: T): Promise<void>;
  get<T>(namespace: string, key: string): Promise<T | undefined>;
  list(namespace: string, options?: { prefix?: string; limit?: number }): Promise<string[]>;
  delete(namespace: string, key: string): Promise<boolean>;
  clear(namespace?: string): Promise<void>;
}
```

Values should be JSON-serializable so future SQLite / Postgres / Redis / S3
backends can persist them without feature-specific serializers.

## Usage

```ts
import {
  createStorageProvider,
  STORAGE_PROVIDER,
  type StorageProvider,
} from "@hridhin-k/badger-shared";

const storage = createStorageProvider(); // memory

await storage.save("traffic", "req-1", { statusCode: 200 });
const row = await storage.get<{ statusCode: number }>("traffic", "req-1");
const keys = await storage.list("traffic", { prefix: "req-" });
await storage.delete("traffic", "req-1");
await storage.clear("traffic");
```

### NestJS

`AppModule` imports `StorageModule`, which binds `STORAGE_PROVIDER`:

```ts
import { Inject, Injectable } from "@nestjs/common";
import { STORAGE_PROVIDER, type StorageProvider } from "@hridhin-k/badger-shared";

@Injectable()
export class ExampleStore {
  constructor(@Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider) {}
}
```

### Factory (composition roots only)

```ts
import { StorageFactory } from "@hridhin-k/badger-shared";

const factory = new StorageFactory();
const storage = factory.create({ backend: "memory" });
// factory.create({ backend: "postgres" }) → throws until implemented
```

## Future backends

| Backend    | Status      | Notes                              |
| ---------- | ----------- | ---------------------------------- |
| `memory`   | Implemented | Process-local; single replica      |
| `sqlite`   | Reserved    | Local durable file                 |
| `postgres` | Reserved    | Multi-instance shared state        |
| `redis`    | Reserved    | Low-latency / TTL                  |
| `s3`       | Reserved    | Large blob / cold traffic archives |

Adding a backend means:

1. Implement `StorageProvider` in `packages/shared` (or a dedicated package).
2. Extend `createStorageProvider` / `StorageFactory` switch.
3. Change only the composition root (`StorageModule` / env config).

No TrafficRecorder or API module changes are required when the backend swaps.

## Rules

- Do not import `MemoryStorage` from feature modules.
- Do not branch on backend kind inside business logic.
- Do not use storage on the Layer 1 HTTP forward hot path synchronously in a way
  that blocks tunneling; prefer EventBus subscribers (TrafficRecorder).
