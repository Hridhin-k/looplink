# Badger Dashboard

Standalone Next.js 16 App Router application for Phase 2 observability UI.

## Architecture

```
CLI  ──(tunnel protocol / WebSocket)──►  Server  ◄──(REST + WebSocket)──  Dashboard
                                              ▲
                                              │
                                         source of truth
```

- The dashboard **never** imports `apps/server` internals.
- Shared protocol types and EventBus contracts come from `@hridhin-k/badger-shared`.
- Product screens are not implemented yet — this package is scaffolding only.

## Folder structure

```
apps/dashboard/
  src/
    app/              App Router entry (layout + empty page)
    components/ui/    Reserved for shadcn/ui primitives
    config/           Typed env → server endpoint config
    hooks/            Reserved for client hooks
    lib/              Shared helpers (`cn` for shadcn)
  components.json     shadcn/ui configuration
  next.config.ts      transpilePackages for badger-shared
  .env.example        NEXT_PUBLIC_BADGER_* endpoints
```

## Environment

| Variable                     | Purpose                 | Default                 |
| ---------------------------- | ----------------------- | ----------------------- |
| `NEXT_PUBLIC_BADGER_API_URL` | Server HTTP origin      | `http://localhost:8080` |
| `NEXT_PUBLIC_BADGER_WS_URL`  | Server WebSocket origin | `ws://localhost:8080`   |

```bash
cp apps/dashboard/.env.example apps/dashboard/.env.local
```

## Scripts

From the monorepo root:

```bash
pnpm dashboard:dev      # next dev on :3001
pnpm dashboard:build    # next build
pnpm dashboard:start    # next start on :3001
pnpm --filter @hridhin-k/badger-dashboard test
pnpm --filter @hridhin-k/badger-dashboard lint
pnpm --filter @hridhin-k/badger-dashboard typecheck
```

## shadcn/ui

Configured via `components.json`. Add primitives later with:

```bash
pnpm --filter @hridhin-k/badger-dashboard exec shadcn@latest add button
```
