# Badger Dashboard — Product & UX Specification

**Package:** `@hridhin-k/badger-dashboard` (`0.1.2`)  
**Path:** `apps/dashboard/`  
**Source of truth:** Code in this repository  
**Related:** [`product.md`](../product.md) · [`docs/cloudflare-dashboard.md`](./cloudflare-dashboard.md) · [`.cursor/rules/dashboard-design.md`](../.cursor/rules/dashboard-design.md)

This document describes the **entire dashboard surface**: purpose, routes, layouts, user flows, UI/UX, design system, live updates, API usage, deployment, and what is intentionally absent.

---

## 1. What the dashboard is

The Badger dashboard is a **standalone Next.js web application** for authenticated HTTP observability and workspace collaboration.

It is **not** the tunnel itself. The CLI opens tunnels. The dashboard lets you:

- Watch live request traffic for the active workspace
- Search, filter, and open individual exchanges
- Replay a captured request through the live tunnel
- View latency and error statistics
- Manage workspace members, invitations, and API keys
- Manage your account (identity, verification, sign-out, delete)

```text
Browser (dashboard)
        │  REST + WebSocket only
        ▼
Badger server (NestJS on Railway)
        │
        ├── Inspector / statistics / replay
        ├── Auth / workspaces / API keys
        └── /dashboard/ws  (live fan-out)
```

**Hard rules (enforced in code and product rules):**

- Dashboard talks **only** to the server’s public REST and WebSocket APIs
- Dashboard must **never** import server internals
- Dashboard must **never** query Supabase directly from React
- Auth is Bearer JWT (default) or optional cookie mode — no server-side sessions in Next

---

## 2. Who it’s for

| Audience | How they use the dashboard |
| --- | --- |
| Solo developers | Personal workspace — inspect webhooks and local API traffic |
| Freelancers / small teams | Shared workspaces — invite members, share traffic visibility |
| CI / automation operators | Create workspace API keys here; CLI uses `badger login --token bgk_…` |
| Visitors | Marketing landing only — no inspector until sign-in |

Anonymous CLI tunnels **do not** appear in the dashboard. Sign-in is required for capture, replay, and workspace UI.

---

## 3. Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js **16.2.12** (App Router) |
| UI library | React **19.2.4** |
| Components | shadcn (`base-nova`) + `@base-ui/react` |
| Icons | `lucide-react` |
| Styling | Tailwind CSS **v4** + CSS variables (`globals.css`) |
| Server state | TanStack Query **v5** |
| Tables | TanStack Table **v8** |
| Client UI state | Zustand **v5** (sidebar + connection) |
| Charts | Recharts **v3** |
| Motion | Framer Motion |
| Syntax highlighting | Shiki (`code-block.tsx`) |
| Themes | `next-themes` — **forced dark** |
| Shared types / live client | `@hridhin-k/badger-shared` (`/dashboard` export) |
| Deploy | OpenNext Cloudflare (`@opennextjs/cloudflare`) + Wrangler |

**Runtime prerequisites (monorepo):** Node.js `>= 20`, pnpm `>= 9`. Cloudflare builds typically use Node `22.19.0`.

---

## 4. Route map (all pages)

**Total routes with `page.tsx`:** **13+** (docs index + `[slug]` + product pages)

### Public (4 + landing + docs)

| Path | Auth | Purpose |
| --- | --- | --- |
| `/` | Public | Marketing landing |
| `/login` | Public | Google OAuth + email/password |
| `/forgot-password` | Public | Request password-reset email |
| `/auth/callback` | Public | OAuth code exchange → session |
| `/auth/reset-password` | Public | Set new password from hash token |
| `/docs` | Public | Documentation hub (A–Z guides) |
| `/docs/[slug]` | Public | Individual production guide article |

### Authenticated product — `(dashboard)` group (7)

| Path | Auth | Purpose |
| --- | --- | --- |
| `/overview` | Required | Live activity + quick links |
| `/tunnels` | Required | Live tunnel sessions for active workspace |
| `/requests` | Required | Request explorer (timeline) |
| `/requests/[id]` | Required | Exchange detail + replay |
| `/statistics` | Required | Aggregates + charts |
| `/workspace` | Required | Members, invites, API keys, settings |
| `/account` | Required | Identity, verification, sign-out, delete |

All `(dashboard)` routes share one layout: `RequireAuth` → `DashboardSocketProvider` → `AppShell`.

Docs use a separate public shell (`DocsShell`) so guides are readable before login. The product sidebar still links to `/docs`.

> **There is no** `/signup`, `/blog`, or `/pricing` route.

---

## 5. Information architecture & layouts

### 5.1 Root layout (`src/app/layout.tsx`)

- Loads **Inter** + **Geist Mono** (`--font-inter`, `--font-geist-mono`) — Lumen ecosystem
- Forces `dark` class on `<html>`
- Document title: `Badger`
- Wraps the tree in `AppProviders`:

```text
ThemeProvider (forced dark)
  └── AuthProvider
        └── QueryProvider
              └── WorkspaceProvider
                    └── TooltipProvider
                          └── {children}
```

### 5.2 Marketing layout (landing only)

No AppShell. Sticky `LandingNav` on the void canvas. Sections scroll on a single page. **Docs** in the nav points to `/docs`.

### 5.3 Product shell (`AppShell`)

```text
┌──────────────────────────────────────────────────────────┐
│ TopNav                                                   │
│  [menu] [collapse]  TITLE   WorkspaceSelector  User  Live│
├────────────┬─────────────────────────────────────────────┤
│ Sidebar    │ ConnectionBanner (when reconnect needed)    │
│ Overview   ├─────────────────────────────────────────────┤
│ Tunnels    │                                             │
│ Requests   │  main  (max-width 1200px)                   │
│ Statistics │                                             │
│ Workspace  │                                             │
│ Account    │                                             │
│ Docs       │                                             │
└────────────┴─────────────────────────────────────────────┘
```

| Chrome | Behavior |
| --- | --- |
| **Desktop sidebar** (`lg+`) | Collapsible **240px ↔ 72px** (Framer Motion); preference persisted in Zustand (`badger-dashboard-ui`) |
| **Mobile sidebar** (`< lg`) | Sheet drawer; closes on navigate |
| **TopNav** | Page title (mono uppercase); workspace switcher; auth controls; connection indicator (`sm+`) |
| **Connection banner** | Shown after a prior successful connect if the live socket drops — reconnect CTA |
| **Main** | Scrollable content, max-width **1200px** |
| **Command palette** | ⌘K — navigate (incl. Tunnels + Docs), search requests, replay, switch workspace |

Live WebSocket is **not** started on landing/login/docs — only inside `(dashboard)` after auth.

---

## 6. Primary navigation

### Product sidebar (`APP_NAV_ITEMS`)

| Order | Label | href | Icon |
| --- | --- | --- | --- |
| 1 | Overview | `/overview` | `LayoutDashboardIcon` |
| 2 | Tunnels | `/tunnels` | `NetworkIcon` |
| 3 | Requests | `/requests` | `ListTreeIcon` |
| 4 | Statistics | `/statistics` | `ActivityIcon` |
| 5 | Workspace | `/workspace` | `SettingsIcon` |
| 6 | Account | `/account` | `UserIcon` |
| 7 | Docs | `/docs` | `BookOpenIcon` |

### Top-nav extras (not sidebar items)

- **Workspace switcher** — personal + shared memberships; persists `badger.activeWorkspaceId`
- **+ Workspace** — create a shared workspace (hidden on very small screens)
- **User email** — links to `/account`
- **Sign out** — clears session → `/login`
- **Connection indicator** — Live / Connecting / Offline

### Landing nav

| Control | Target |
| --- | --- |
| Brand | `/` |
| Product | `#product` |
| Features | `#features` |
| Docs | `#start` |
| Sign in / Open dashboard | `/login` or `/overview` if already signed in |

---

## 7. Design system & UX language (“Factory”)

The product UI follows the **Factory** design reference (dark terminal war room). Full token table: `.cursor/rules/dashboard-design.md`.

### Visual principles

- Near-black canvas (`#101010`) with light figure panels (`#eeeeee` / chalk)
- Almost all UI is monochrome; **Signal Orange** and **Metric Green** are reserved for status / live / metrics accents
- Flat surfaces, thin 1px borders, minimal radii — depth from contrast and spacing, not shadows
- Geist weight **400** by default; mono uppercase labels for terminal voice

### Key tokens (implemented in `globals.css`)

| Name | Hex | Role |
| --- | --- | --- |
| Obsidian Canvas | `#101010` | Page background |
| Carbon Lift | `#1d1a18` | Raised surfaces, nav wells |
| Ash Stroke | `#3d3a39` | Borders, separators |
| Warm Granite | `#8a8380` | Secondary text |
| Pale Stone | `#b8b3b0` | Tertiary / eyebrows |
| Bone | `#eeeeee` | Primary text / light cards |
| Chalk | `#fafafa` | High-emphasis fills |
| Signal Orange | `#ee6018` | Accent |
| Metric Green | `#a0ca92` | Live / positive metric accent |

### Typography

| Family | Use |
| --- | --- |
| Geist | Body, headings, buttons, nav |
| Geist Mono | Captions, status tags, metric units, page titles (often uppercase) |

### Shape & layout

| Token | Value |
| --- | --- |
| Nav / button radius | ~3px |
| Cards | ~10px |
| Large panels | ~20px |
| Page max-width | 1200px |
| Spacing base | 8px |

### Theme

- **Dark only** in production UI (`forcedTheme="dark"`, `enableSystem={false}`)
- A `ThemeToggle` component exists in the codebase but is **not mounted** anywhere

### Component library

shadcn-style primitives under `src/components/ui/`: alert, badge, button, card, input, select, sheet, table, tabs, tooltip, skeleton, scroll-area, separator, etc.

---

## 8. User flows

### 8.1 First visit → signed-in overview

```text
/  (landing)
 │  “Sign in” / “Open dashboard”
 ▼
/login
 │  Google OAuth  or  email + password
 ▼
/auth/callback   (OAuth only)
 │
 ▼
/overview        (or ?next=<safe path>)
```

Safe post-login redirects are stored in `sessionStorage` (`badger.auth.next`) and must be relative paths.

### 8.2 Inspect live traffic

```text
CLI: badger login && badger 3000 -w Personal
        │
        ▼
External HTTP → public URL → local app
        │
        ▼
Server records exchange (workspace-scoped)
        │
        ▼
/dashboard/ws  → request_received / response_completed
        │
        ▼
/overview  (recent list)  or  /requests  (full explorer)
        │
        ▼
/requests/[id]  → Replay
```

### 8.3 Search and filter

1. Open `/requests`
2. Type into search (debounced **300ms**) → server full-text `q`
3. Optionally filter by **method**, **status class** (2xx–5xx / pending), **tunnel id** (client-side column filters)
4. Sort columns; paginate (**25** rows per page)
5. Click a row → `/requests/[id]` (preserves `q` for highlight when present)
6. **Reset** clears search + filters

### 8.4 Replay

1. Open request detail
2. Click **Replay**
3. Client `POST /api/v1/inspector/replay/:id`
4. Response panel shows status, headers, body, cookies
5. On success (or live `replay_completed`), inspector queries invalidate / refresh

### 8.5 Workspace collaboration

```text
TopNav workspace switcher
        │
        ├── Select Personal / Shared
        ├── “+ Workspace” → create shared → switch to it
        ▼
/workspace
        ├── General   — name, description, accept invite, delete shared
        ├── Members   — roles, remove
        ├── Invites   — create, copy token once, revoke
        └── API keys  — create, copy secret once, rotate, revoke
```

Owner/admin can manage invites and API keys. Deleting a shared workspace requires owner + typed confirmation.

### 8.6 Account

```text
/account
  ├── View email, verification status, user id, active workspace
  ├── Resend verification email
  ├── Sign out → /login
  └── Delete account (type: delete my account)
```

### 8.7 Password recovery

```text
/login → Forgot password → /forgot-password
        │
        ▼
Email with reset link
        │
        ▼
/auth/reset-password#access_token=…
        │
        ▼
Set new password → /login
```

---

## 9. Page-by-page feature reference

### 9.1 Landing `/`

| Block | Content |
| --- | --- |
| Hero | Brand pitch (“Ship tunnels. Inspect everything.”), CTAs |
| Trust strip | Supporting credibility strip |
| Features | Four cards: Tunnels, Inspector, Replay, Workspaces |
| CTA / Start | Get-started section (`#start`) — treated as “Docs” in nav |
| Footer | Closing links / brand |

No authenticated APIs. If already signed in, primary CTA goes to `/overview`.

### 9.2 Login `/login`

- Continue with **Google** (OAuth PKCE via Nest `oauth/start` → provider → `/auth/callback`)
- **Email + password** form
- Link to forgot password
- Errors via alerts; loading states while exchanging codes / submitting

### 9.3 Overview `/overview`

| Element | Detail |
| --- | --- |
| Header | Active workspace name + “Live feed” when WS connected |
| KPI tiles | Total requests, error rate, avg latency, P95 (from statistics API) |
| Recent traffic | Up to **8** of the latest requests (from list API, limit 20) |
| Empty state | Getting-started copy + CLI snippet when no traffic |
| Errors | Destructive alert + **Retry** |
| Loading | Skeleton KPI grid + list |

### 9.4 Requests `/requests`

| Element | Detail |
| --- | --- |
| Table | TanStack Table — method, status, path/URL, tunnel, latency, time |
| Live badge | “· live” when socket connected |
| Search | Server `q`, 300ms debounce |
| Filters | Method, status class, tunnel |
| Pagination | Page size **25** |
| Row interaction | Click / Enter / Space → detail (`role="link"`, `aria-label`) |
| Empty / error | Dedicated empty copy; alert + retry |

Default fetch limit for the explorer list: **1000** retained summaries (server retention also caps at 1000).

### 9.5 Request detail `/requests/[id]`

| Element | Detail |
| --- | --- |
| Summary | Method + status badges, id, path, tunnel, timestamp, latency, error |
| Timeline | Estimated phases from total `latencyMs` (not measured phase timestamps) |
| Replay | `RequestReplay` control + response panel |
| Tabs | Request / Response — headers, query, cookies, bodies |
| Bodies | Shiki-highlighted code blocks; truncation awareness |
| Search highlight | When navigated with `?q=` |

### 9.6 Statistics `/statistics`

| Element | Detail |
| --- | --- |
| KPIs | Requests/min, average latency, P95, error % |
| Charts | Requests over time, latency over time, status distribution, methods, tunnel activity |
| Time series | **Client-derived** from up to 1000 request summaries (not a dedicated time-series API) |
| Live | Invalidates on `statistics_updated` |

### 9.7 Workspace `/workspace`

Tabbed settings page for the **active** workspace:

| Tab | Features |
| --- | --- |
| General | Edit name/description; accept invite token; delete shared workspace (owner) |
| Members | List members; change role; remove |
| Invites | Invite by email + role; show/copy token once; revoke |
| API keys | Create named key; show/copy `bgk_…` secret once; rotate; revoke |

Permission gating: manage invites/keys when role is `owner` or `admin`.

### 9.8 Account `/account`

Identity card, email verification actions, sign-out, destructive account deletion with confirmation phrase **`delete my account`**.

---

## 10. Live updates (WebSocket)

| Item | Value |
| --- | --- |
| Path | `/dashboard/ws` |
| Client | `DashboardLiveClient` from `@hridhin-k/badger-shared/dashboard` |
| Auth | Query `access_token`; optional `workspaceId` |
| Scope | Active workspace only |
| Mounted | Only under `(dashboard)` layout after `RequireAuth` |

### Events → UI

| Server event | Dashboard effect |
| --- | --- |
| `connected` | Connection store → connected |
| `ping` | Ignored (liveness) |
| `request_received` | Upsert into request list cache (or invalidate if search active) |
| `response_completed` | Patch list row + invalidate detail query |
| `replay_completed` | Invalidate workspace-scoped inspector queries |
| `statistics_updated` | Invalidate statistics queries |
| `tunnel_connected` / `tunnel_disconnected` | No UI handler today (no-op in `applyDashboardMessage`) |

Reconnect: ~every **5s** with a fresh access token; online/offline listeners; after reconnect, inspector queries are resynced.

Shell feedback: `ConnectionIndicator` + `ConnectionBanner` (`role="status"`, `aria-live="polite"`).

---

## 11. Auth & session model

| Concern | Implementation |
| --- | --- |
| Session storage | `localStorage` key `badger.auth.session` (`accessToken`, `refreshToken`, `expiresAt`, `user`) |
| Active workspace | `localStorage` key `badger.activeWorkspaceId` |
| OAuth PKCE | `sessionStorage` `badger.auth.pkce` |
| Post-login next | `sessionStorage` `badger.auth.next` |
| Gate | `RequireAuth` → `/login?next=<encoded path>` |
| Hydration | Near expiry → refresh; else `GET /api/v1/me` |
| Refresh skew | ~60s before expiry; `withAccessToken` force-refreshes once on **401** |
| Default credentials | Bearer header; `credentials: "omit"` |
| Optional cookie mode | `NEXT_PUBLIC_BADGER_AUTH_COOKIE_ENABLED` → `credentials: "include"` + CSRF header from `badger_csrf` |

**CLI and dashboard sessions are separate.** Logging into the CLI does not sign you into the dashboard (and vice versa).

**No signup page** — accounts come from Google OAuth or Supabase-managed email flows.

---

## 12. API usage from the browser

Base URL: `NEXT_PUBLIC_BADGER_API_URL` (default `http://localhost:8080`), baked at **build** time for Workers.

| Area | Endpoints used by the UI |
| --- | --- |
| Auth | `/api/v1/auth/login`, `oauth/start`, `oauth/callback`, `refresh`, `logout`, `password/*`, `email/*`, `DELETE /api/v1/auth/account`, `GET /api/v1/me` |
| Inspector | `GET /api/v1/inspector/requests`, `GET …/request/:id`, `POST …/replay/:id`, `GET …/statistics` |
| Workspaces | `/api/v1/workspaces…` (CRUD, members, invitations, api-keys) |

Inspector calls send `Authorization: Bearer …` and `x-workspace-id` for the active workspace.

---

## 13. Environment variables

| Variable | Role | Default / notes |
| --- | --- | --- |
| `NEXT_PUBLIC_BADGER_API_URL` | HTTP API origin | `http://localhost:8080` — **must** be set on Cloudflare builds |
| `NEXT_PUBLIC_BADGER_WS_URL` | Optional WS base override | Else derived from API URL → `/dashboard/ws` |
| `NEXT_PUBLIC_BADGER_AUTH_COOKIE_ENABLED` | Cookie session mode | Off by default |

If `NEXT_PUBLIC_BADGER_API_URL` is missing in production, the Worker ships localhost defaults and the browser fails with connection refused to `localhost:8080`.

---

## 14. Responsive & accessibility

| Pattern | Detail |
| --- | --- |
| Breakpoint | Persistent sidebar from `lg`; Sheet below |
| Connection pill | Hidden below `sm` |
| Create workspace button | Hidden on xs |
| Request rows | Keyboard activatable (`role="link"`, Enter/Space) |
| Auth checking | `aria-busy` / “Checking session” |
| Collapsed sidebar | `sr-only` labels + `title` tooltips |
| Landing nav | Product/Features/Docs links compacted on small screens |

---

## 15. Interactions cheat sheet

| Interaction | Where | Result |
| --- | --- | --- |
| Open request | Requests table | Navigate to detail |
| Search / filter / reset | Requests toolbar | Refetch / client filter |
| Replay | Request detail | POST replay → panel |
| Switch workspace | Top nav | Persist id; invalidate inspector queries |
| Create workspace | Top nav | Create shared + switch |
| Copy invite / API key | Workspace | Clipboard (secrets shown once) |
| Accept invite | Workspace → General | Paste token |
| Collapse sidebar | Desktop top nav / control | Persist UI preference |
| Reconnect | Connection banner | Manual WS reconnect |
| Sign out | Top nav / Account | Clear session → login |
| Delete workspace / account | Workspace / Account | Typed confirmation |

---

## 16. Source map (`apps/dashboard/src`)

```text
app/
  layout.tsx, page.tsx, globals.css, error.tsx, global-error.tsx
  login/, forgot-password/, auth/callback/, auth/reset-password/
  (dashboard)/
    layout.tsx, loading.tsx
    overview/, requests/, requests/[id]/, statistics/, workspace/, account/

components/
  auth/          require-auth, login-form, auth-nav-controls
  landing/       page, hero, nav, features, cta, footer, trust
  layout/        app-shell, sidebar, mobile-sidebar, top-nav, nav-items, connection-*
  providers/     app, auth, query, theme, workspace, dashboard-socket
  requests/      explorer, details, replay, timeline, badges, code/body viewers
  statistics/    view, KPIs, charts
  workspaces/    workspace-selector
  ui/            shadcn primitives

hooks/           use-inspector-requests|request|statistics, use-replay-request
lib/             api/, auth/, workspaces/, ws/, env, statistics helpers
stores/          ui-store, connection-store
```

Shared live client: `packages/shared/src/dashboard/` → import `@hridhin-k/badger-shared/dashboard`.

---

## 17. Deployment (summary)

Full runbook: [`docs/cloudflare-dashboard.md`](./cloudflare-dashboard.md).

| Item | Value |
| --- | --- |
| Worker name | `looplink` (`wrangler.jsonc`) |
| Adapter | OpenNext Cloudflare |
| Production branch | `main` (Workers Builds) |
| Build | Build shared → `opennextjs-cloudflare build` |
| Deploy | `opennextjs-cloudflare deploy` |
| Intended domain | `dashboard.wybrand.in` (Wrangler custom-domain route currently commented out) |
| Interim URL | `looplink.<account>.workers.dev` |
| API CORS | If `BADGER_ALLOWED_ORIGINS` is locked on Railway, include the Worker origin |

Local scripts in the package: `dev`, `build`, `start`, `lint`, `preview`, `deploy`, `upload`, `cf-typegen`.

---

## 18. What is intentionally not in the dashboard

| Absent | Notes |
| --- | --- |
| Blog / news / CMS | No content routes |
| Documentation site | Landing `#start` only; product docs live in repo Markdown |
| Signup / register page | OAuth / Supabase-managed users |
| Tunnels management page | Tunnel ids appear as filters/KPIs only |
| Pricing / enterprise / careers | Not implemented (design-rule marketing examples are not product routes) |
| Light theme product UI | Forced dark; unused theme toggle |
| Direct Supabase from React | Nest API only |
| End-user WebSocket debugging UI | Tunnel data plane is HTTP-only; HMR over public URL is unsupported |
| Anonymous traffic in inspector | Sign-in + workspace required |

---

## 19. Relationship to CLI & server

| Concern | Dashboard | CLI |
| --- | --- | --- |
| Open tunnel | No | `badger [port]` |
| Inspect / replay UI | Yes | Replay via `badger replay <id>` (API) |
| Session file | Browser `localStorage` | `~/.config/badger/auth.json` |
| Workspace switch | Top nav | `badger workspace use` |
| API keys | Create/rotate/revoke in UI | `badger login --token bgk_…` |

Traffic history is **in-memory on the server**. Redeploying Railway clears inspector data even though the dashboard UI remains available.

---

## 20. Documentation & maintenance notes

When changing the dashboard:

1. Keep routes listed in §4 and nav in §6 in sync with `nav-items.ts` and `app/**/page.tsx`
2. Do not add features to this doc that are not shipped
3. Preserve Factory tokens when adding UI (`.cursor/rules/dashboard-design.md`)
4. Never call Supabase from client components
5. Bake `NEXT_PUBLIC_BADGER_API_URL` into Cloudflare builds whenever the API origin changes
6. Update [`product.md`](../product.md) only for product-level capability changes; keep this file for dashboard depth

---

*Dashboard specification derived from `apps/dashboard` and related shared/live-client code. If this file and older docs disagree, follow the code.*
