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

6. **Save and Deploy**. Later pushes to `main` trigger a new build automatically.

If Cloudflare asks for a package manager, use **pnpm** (see root `package.json`
`packageManager` / engines).

## Custom domain `dashboard.wybrand.in`

`apps/dashboard/wrangler.jsonc` already declares:

```jsonc
"routes": [{ "pattern": "dashboard.wybrand.in", "custom_domain": true }]
```

**Requirements**

1. Zone `wybrand.in` on the **same Cloudflare account** as the Worker.
2. After a successful deploy, Cloudflare attaches the hostname and TLS.

**Manual alternative:** Workers → `badger-dashboard` → **Settings** →
**Domains & Routes** → add `dashboard.wybrand.in`.

Keep existing `tunnel.wybrand.in` DNS for Railway unchanged.

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

- Worker name: `badger-dashboard`
- Build output: `apps/dashboard/.open-next/` (gitignored)
- Prefer Workers Builds over local `pnpm deploy` for reproducible production
  deploys (local `.env.local` / `.dev.vars` can skew the build).
