# Badger — Commands Reference

Copy-paste commands for local development, production use, install/publish of the CLI, and deploying the server and dashboard.

**Prerequisites:** Node.js `>= 20`, pnpm `>= 9`.

> Do **not** run `pnpm server` — that is a pnpm built-in (store server), not Badger. Use `pnpm start:server` or `pnpm server:start`.

---

## 1. Clone and install (monorepo)

```bash
git clone https://github.com/Hridhin-k/looplink.git
cd looplink
pnpm install
pnpm build
```

Optional host env template:

```bash
cp .env.example .env
```

Dashboard local env:

```bash
cp apps/dashboard/.env.example apps/dashboard/.env.local
# edit NEXT_PUBLIC_BADGER_API_URL if needed
```

---

## 2. Run locally (monorepo)

### 2.1 Build

```bash
pnpm build
pnpm typecheck
pnpm clean          # remove dist outputs
```

### 2.2 Server (terminal 1)

```bash
pnpm start:server
# or
pnpm server:start
# or
node ./apps/server/dist/main.js
```

Default listen: `0.0.0.0:8080`.

Health check:

```bash
curl -s http://127.0.0.1:8080/health
# {"status":"ok"}
```

Useful local env (shell or `.env`):

```bash
export HOST=0.0.0.0
export PORT=8080
export BADGER_PUBLIC_BASE_DOMAIN=localhost
export BADGER_PUBLIC_URL_MODE=path   # or subdomain
```

### 2.3 Dashboard (terminal 2)

```bash
pnpm dashboard
# or
pnpm --dir apps/dashboard dev
```

Opens Next.js dev server (default `http://localhost:3000`).

Point it at the local server in `apps/dashboard/.env.local`:

```bash
NEXT_PUBLIC_BADGER_API_URL=http://localhost:8080
```

### 2.4 CLI tunnel (terminal 3)

Your app must already be listening on the local port you pass (e.g. `3000` or `8081`).

```bash
# Via monorepo script (after pnpm build)
pnpm cli -- 3000 --server ws://127.0.0.1:8080

# Direct
node ./apps/cli/dist/index.js 3000 --server ws://127.0.0.1:8080

# Or env
export BADGER_SERVER_URL=ws://127.0.0.1:8080
pnpm cli -- 3000
```

Replay a recorded request (tunnel still connected):

```bash
pnpm cli -- replay <requestId> --server ws://127.0.0.1:8080
```

### 2.5 Full local stack (checklist)

```bash
pnpm build
pnpm start:server          # :8080
pnpm dashboard             # :3000 → API http://localhost:8080
# start your app on e.g. :8081, then:
pnpm cli -- 8081 --server ws://127.0.0.1:8080
```

Open dashboard: `http://localhost:3000/requests`  
Hit the printed public tunnel URL, then refresh Requests / Statistics.

---

## 3. Run with Docker (server only)

```bash
# Development (rebuilds from mounted sources)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

# Production-style image
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

CLI against Docker-published port:

```bash
pnpm cli -- 3000 --server ws://127.0.0.1:8080
curl -s http://127.0.0.1:8080/health
```

Change host publish port:

```bash
echo 'PORT=9090' > .env
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
pnpm cli -- 3000 --server ws://127.0.0.1:9090
```

Stop:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml down
# or prod overlay
docker compose -f docker-compose.yml -f docker-compose.prod.yml down
```

---

## 4. Production use (hosted server + CLI)

Default CLI server (baked into the package):

```text
wss://looplinkserver-production.up.railway.app
```

### 4.1 Install the CLI (download the package)

GitHub Packages needs auth even for public packages. Create a PAT with `read:packages`, then add to `~/.npmrc`:

```ini
@hridhin-k:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_PAT
```

Install globally:

```bash
npm install -g @hridhin-k/badger-cli
badger --version
```

One-off (no global install):

```bash
npx @hridhin-k/badger-cli 3000
```

Uninstall:

```bash
npm uninstall -g @hridhin-k/badger-cli
```

### 4.2 Tunnel against production Railway

```bash
# Uses default wss://looplinkserver-production.up.railway.app
badger 3000

# Explicit
badger 3000 --server wss://looplinkserver-production.up.railway.app

# Or env
export BADGER_SERVER_URL=wss://looplinkserver-production.up.railway.app
badger 3000
```

From the monorepo without global install:

```bash
pnpm build
pnpm cli -- 3000 --server wss://looplinkserver-production.up.railway.app
```

Replay:

```bash
badger replay <requestId> --server wss://looplinkserver-production.up.railway.app
```

### 4.3 Production dashboard

Deployed Cloudflare Worker (example):

```text
https://58ea1baf-looplink.hridhinchembakasseri.workers.dev
```

Intended custom domain (when DNS zone is on Cloudflare): `https://dashboard.wybrand.in`

Must be built with:

```text
NEXT_PUBLIC_BADGER_API_URL=https://looplinkserver-production.up.railway.app
```

Smoke checks:

```bash
curl -sS https://looplinkserver-production.up.railway.app/health
curl -sS "https://looplinkserver-production.up.railway.app/api/v1/inspector/requests?limit=5"
```

---

## 5. Deploy the server (Railway)

Configured via `railway.json` + root `Dockerfile`. Push/merge to the branch Railway watches (typically `main`), or trigger deploy in the Railway UI.

**Required Railway service variables:**

| Variable | Example |
| --- | --- |
| `BADGER_PUBLIC_BASE_DOMAIN` | `looplinkserver-production.up.railway.app` or `tunnel.wybrand.in` |
| `BADGER_PUBLIC_URL_MODE` | `path` (recommended on Railway) |
| `HOST` | `0.0.0.0` |
| `PORT` | Railway-provided |

Optional:

```text
BADGER_ALLOWED_ORIGINS=https://58ea1baf-looplink.hridhinchembakasseri.workers.dev
```

(Empty allow-list = permissive CORS.)

Health: `GET /health`  
Replicas: keep at **1** (in-memory tunnels).

CLI after deploy:

```bash
badger 3000 --server wss://YOUR_RAILWAY_HOST
```

Details: [docs/railway.md](docs/railway.md)

---

## 6. Deploy the dashboard (Cloudflare Workers / OpenNext)

### 6.1 Automatic (recommended)

1. Cloudflare → Workers → project **`looplink`** → Settings → Build → connect GitHub `Hridhin-k/looplink`, branch `main`.
2. Build settings:

```text
Build command:
pnpm --filter @hridhin-k/badger-shared build && pnpm --dir apps/dashboard exec opennextjs-cloudflare build

Deploy command:
pnpm --dir apps/dashboard exec opennextjs-cloudflare deploy
```

3. Build variables:

```text
NODE_VERSION=22.19.0
NEXT_PUBLIC_BADGER_API_URL=https://looplinkserver-production.up.railway.app
```

4. Push/merge to `main` → Cloudflare builds and deploys.

### 6.2 Manual deploy from your machine

```bash
# one-time
npx wrangler login

pnpm --filter @hridhin-k/badger-shared build
cd apps/dashboard
NEXT_PUBLIC_BADGER_API_URL=https://looplinkserver-production.up.railway.app pnpm deploy
```

Other dashboard scripts:

```bash
pnpm --dir apps/dashboard preview    # OpenNext build + local Wrangler preview
pnpm --dir apps/dashboard upload     # upload version (gradual deploy path)
pnpm --dir apps/dashboard build      # next build only
```

Details: [docs/cloudflare-dashboard.md](docs/cloudflare-dashboard.md)

---

## 7. Publish CLI + shared packages (GitHub Packages)

**Published packages:** `@hridhin-k/badger-shared`, `@hridhin-k/badger-cli`  
**Registry:** `https://npm.pkg.github.com`  
**Packages UI:** https://github.com/Hridhin-k/looplink/packages

### 7.1 One-time auth (publish)

PAT needs `write:packages`, `read:packages`, and `repo` if the repo is private. User `~/.npmrc`:

```ini
@hridhin-k:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_PAT
```

### 7.2 Automated (recommended)

```bash
pnpm changeset          # pick packages + bump type + summary
git add .changeset && git commit -m "chore: add changeset"
# open PR → merge to main
# GitHub Action opens/updates Version Packages PR
# merge that PR → packages publish automatically
```

Workflow: `.github/workflows/release.yml`

### 7.3 Manual publish

```bash
pnpm publish:cli
```

Equivalent:

```bash
pnpm build
pnpm --filter @hridhin-k/badger-shared publish
pnpm --filter @hridhin-k/badger-cli publish
```

Changesets helpers:

```bash
pnpm version-packages   # apply bumps from changesets locally
pnpm release            # changeset publish
```

Details: [docs/publishing.md](docs/publishing.md)

---

## 8. Quality checks

```bash
pnpm lint
pnpm lint:fix
pnpm format
pnpm format:check
pnpm test                 # unit: shared + server + cli
pnpm test:e2e             # build + black-box e2e
pnpm --filter @hridhin-k/badger-dashboard build
pnpm --filter @hridhin-k/badger-dashboard lint
```

---

## 9. Quick cheat sheet

| Goal | Command |
| --- | --- |
| Install monorepo | `pnpm install && pnpm build` |
| Run server locally | `pnpm start:server` |
| Run dashboard locally | `pnpm dashboard` |
| Tunnel to local server | `pnpm cli -- 3000 --server ws://127.0.0.1:8080` |
| Tunnel to production | `badger 3000` or `pnpm cli -- 3000 --server wss://looplinkserver-production.up.railway.app` |
| Install CLI from registry | `npm install -g @hridhin-k/badger-cli` |
| Publish CLI | `pnpm changeset` → merge → version PR, or `pnpm publish:cli` |
| Deploy server | Push to Railway-watched branch / Railway UI |
| Deploy dashboard | Push to `main` (CF Builds) or `cd apps/dashboard && NEXT_PUBLIC_BADGER_API_URL=… pnpm deploy` |
| Docker server (dev) | `docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build` |
| Health | `curl -s http://127.0.0.1:8080/health` |

---

## 10. Related docs

| Doc | Topic |
| --- | --- |
| [product.md](product.md) | Full product / feature spec |
| [README.md](README.md) | Project overview |
| [docs/railway.md](docs/railway.md) | Server deploy |
| [docs/cloudflare-dashboard.md](docs/cloudflare-dashboard.md) | Dashboard deploy |
| [docs/publishing.md](docs/publishing.md) | Package publish |
| [apps/cli/README.md](apps/cli/README.md) | CLI install & usage |
| [docker/README.md](docker/README.md) | Docker server |
| [e2e/README.md](e2e/README.md) | E2E harness |
