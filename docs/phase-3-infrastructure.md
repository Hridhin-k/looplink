# Phase 3.1 — Infrastructure Foundation

**Status:** Implemented  
**Date:** 2026-07-29  
**Scope:** Prepare multi-tenancy infrastructure without changing user behavior

---

## Decision

Add a NestJS `DatabaseModule` and Supabase CLI migration tree behind the existing
tunnel/observability stack. Supabase is an optional infrastructure dependency:
when `SUPABASE_*` env vars are unset, Phases 1–2 keep working unchanged.

## Architecture

```text
Dashboard / CLI
      │
      ▼
 NestJS API  ──▶  DatabaseModule  ──▶  Supabase (optional)
      │                 │
      │                 ├── SUPABASE_CONFIG (validated)
      │                 ├── SUPABASE_ANON_CLIENT
      │                 ├── SUPABASE_SERVICE_ROLE_CLIENT
      │                 └── DATABASE_CLIENT (DB-agnostic ping port)
      ▼
 Repositories (interfaces + Symbol tokens; domain repos in later phases)
```

Rules enforced:

- Business logic depends on interfaces / `DATABASE_CLIENT`, not `@supabase/supabase-js`
- Dashboard must not import Supabase (unchanged; API-only)
- No login, workspace, CLI, or WebSocket protocol changes in this phase

## Configuration

| Variable | Required when enabled | Purpose |
| --- | --- | --- |
| `SUPABASE_URL` | yes | Project API URL |
| `SUPABASE_ANON_KEY` | yes | Anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Server-only privileged key |

Validation is fail-fast: any one set ⇒ all three required and format-checked.
On boot with Supabase enabled, `DatabaseConnectivityService` pings Auth.

## Migrations

Local CLI project: `supabase/` (`config.toml` + `migrations/`).

Baseline migration `*_phase_3_1_foundation.sql` enables `pgcrypto` only.
No workspace/auth tables yet (additive schema comes in later phases).

```bash
pnpm db:start          # local Supabase stack
pnpm db:reset          # apply migrations
pnpm db:migration:new  # scaffold a new additive migration
```

## Out of scope (later phases)

- Auth / login → see `docs/phase-3-authentication.md` (Phase 3.2)
- Workspace domain model
- Dashboard or CLI changes
- Tunnel protocol changes
