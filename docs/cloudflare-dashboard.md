# Deploying the Badger dashboard on Cloudflare

OpenNext (`@opennextjs/cloudflare`) deploys the Next.js dashboard as a
**Cloudflare Worker**. Connect the GitHub repo in the Cloudflare dashboard so
every push to `main` builds and deploys automatically (no GitHub Actions
needed).

Target URL: `https://dashboard.wybrand.in`  
API backend: Railway Badger server (same pattern as `tunnel.wybrand.in`).

## Connect GitHub (recommended)

1. Open [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages).
2. **Create application** → **Import a repository** (or open existing Worker
   `badger-dashboard` → **Settings** → **Builds** → **Connect**).
3. Authorize GitHub and select **[Hridhin-k/looplink](https://github.com/Hridhin-k/looplink)**.
4. Configure the build:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Root directory | *(leave empty — monorepo root)* |
| Build command | `pnpm --filter @hridhin-k/badger-shared build && pnpm --dir apps/dashboard exec opennextjs-cloudflare build` |
| Deploy command | `pnpm --dir apps/dashboard exec opennextjs-cloudflare deploy` |
| Non-production branch deploy | optional (preview versions) |

5. Under **Build variables and secrets**, set:

| Variable | Example |
| --- | --- |
| `NODE_VERSION` | `22.19.0` |
| `NEXT_PUBLIC_BADGER_API_URL` | `https://looplinkserver-production.up.railway.app` |

Repo root also has [`.nvmrc`](../.nvmrc) (`22.19.0`) so Workers Builds picks a Node that satisfies `undici` (`>=22.19.0`). Prefer the build variable if `.nvmrc` is not detected.

`NEXT_PUBLIC_*` is baked in at **build** time — set it on the Cloudflare build
environment, not only as a Worker runtime secret.

If this variable is missing, the Worker ships with the default
`http://localhost:8080` and the browser will spam
`ws://localhost:8080/dashboard/ws` / `ERR_CONNECTION_REFUSED`.

Also ensure `apps/dashboard/wrangler.jsonc` has `"keep_names": false`
(already set) so `next-themes` does not throw `ReferenceError: __name is not defined`.

6. **Save and Deploy**. Later pushes to `main` trigger a new build automatically.

If Cloudflare asks for a package manager, use **pnpm** (see root `package.json`
`packageManager` / engines).

## Custom domain `dashboard.wybrand.in`

Deploy succeeds on `*.workers.dev` first. Custom domains require the zone
`wybrand.in` to live on the **same Cloudflare account** as Worker `looplink`.

**Error you may see:** `Could not find zone for dashboard.wybrand.in` — the
domain’s nameservers are not on this Cloudflare account (Railway DNS for
`tunnel.wybrand.in` alone is not enough).

### Attach the domain

1. Cloudflare Dashboard → **Add a site** → `wybrand.in` (if not already).
2. Point the registrar nameservers to Cloudflare (keep existing records such as
   `tunnel` → Railway).
3. Workers → **looplink** → **Domains** → add `dashboard.wybrand.in`  
   **or** uncomment in `apps/dashboard/wrangler.jsonc`:

```jsonc
"routes": [{ "pattern": "dashboard.wybrand.in", "custom_domain": true }]
```

4. Redeploy.

Until then, use the Worker URL shown under **Domains** (e.g.
`looplink.<subdomain>.workers.dev`).

## Railway CORS / origins (optional)

If `BADGER_ALLOWED_ORIGINS` is empty, any origin is allowed. If you lock it
down, include:

```text
BADGER_ALLOWED_ORIGINS=https://dashboard.wybrand.in
```

## Local commands

| Script | Purpose |
| --- | --- |
| `pnpm dashboard` | Next.js dev server |
| `pnpm --dir apps/dashboard preview` | OpenNext build + Wrangler preview |
| `pnpm --dir apps/dashboard deploy` | Manual build + deploy (after `wrangler login`) |

## Notes

- Worker name: `looplink` (must match the Cloudflare Worker)
- Build output: `apps/dashboard/.open-next/` (gitignored)
- Prefer Workers Builds over local `pnpm deploy` for reproducible production
  deploys (local `.env.local` / `.dev.vars` can skew the build).

### If builds stop after a merge

Dashboard shows **"This project is disconnected from your Git account"** →
**Settings → Build → Connect** (re-authorize GitHub). Until that is fixed,
pushes to `main` will not trigger Cloudflare (Railway can still deploy).
