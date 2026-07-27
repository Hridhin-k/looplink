# Dashboard scaffolding (Phase 2 prep)

The Badger dashboard is a standalone Next.js 16 application under `apps/dashboard`.

## Boundaries

| Client    | Transport                    | May import                     |
| --------- | ---------------------------- | ------------------------------ |
| CLI       | Tunnel WebSocket protocol    | `@hridhin-k/badger-shared`     |
| Dashboard | Public REST + WebSocket APIs | `@hridhin-k/badger-shared`     |
| Server    | Owns state                   | everything under `apps/server` |

The dashboard must never import Nest modules, repositories, or other server
internals. The server remains the single source of truth.

## Monorepo wiring

- pnpm workspace member via `apps/*`
- Depends on `@hridhin-k/badger-shared` (`workspace:*`)
- `next.config.ts` sets `transpilePackages: ["@hridhin-k/badger-shared"]`
- TypeScript extends `tsconfig.base.json` with Next/Bundler overrides
- Root `pnpm build` runs `tsc -b` then `next build` for the dashboard
- Root `pnpm lint` runs the monorepo ESLint pass, then the dashboard Next ESLint config
- Prettier is shared at the repository root

## Environment

See `apps/dashboard/.env.example`:

- `NEXT_PUBLIC_BADGER_API_URL`
- `NEXT_PUBLIC_BADGER_WS_URL`

## Status

Scaffold only. No product UI screens are implemented in this phase.
