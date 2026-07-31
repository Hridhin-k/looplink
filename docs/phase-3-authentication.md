# Phase 3.2 — Authentication

**Status:** Implemented  
**Date:** 2026-07-29  
**Scope:** Authenticate users. Nothing else (no workspaces, CLI, or tunnel ownership).

---

## Decision

Auth is mediated entirely by the Nest API. The dashboard never imports Supabase —
it calls Badger auth endpoints and stores JWTs in `localStorage` for session
persistence across refreshes.

```text
Dashboard ──▶ POST /api/v1/auth/login|refresh|logout
         ──▶ GET  /api/v1/me   (Bearer JWT)
                │
                ▼
           AuthService ──▶ Supabase Auth (anon / service role clients)
```

## Endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/v1/auth/login` | public | Email/password → session |
| `POST` | `/api/v1/auth/refresh` | public | Refresh token → new session |
| `POST` | `/api/v1/auth/logout` | Bearer | Invalidate refresh tokens |
| `GET` | `/api/v1/me` | Bearer | Current user |

JWT verification uses `supabase.auth.getUser(accessToken)`.
Protected routes also run `AuthMiddleware` + `JwtAuthGuard`.

## Dashboard

| Route | Access |
| --- | --- |
| `/login` | Public sign-in |
| `/account` | Protected (`RequireAuth`) |
| `/`, `/requests`, `/statistics` | **Remain public** (existing dashboard) |

Session key: `badger.auth.session` in `localStorage`.

## Out of scope

- Workspaces / membership
- CLI OAuth
- Tunnel ownership
- Signup UI (create users in Supabase Auth dashboard)
