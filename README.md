# Badger

Expose localhost through secure public URLs.

Badger is an open-source developer tool, similar to ngrok, that tunnels traffic from a public
URL to a service running on your machine.

> **Migrating from LoopLink?** See [docs/migration.md](docs/migration.md).
> The `looplink` CLI binary remains available as a deprecated alias for one release.

## Repository layout

```
apps/
  cli/        @hridhin-k/badger-cli       — command-line client run by developers
  server/     @hridhin-k/badger-server    — public tunnel server that relays traffic
  dashboard/  @hridhin-k/badger-dashboard — standalone Next.js UI (REST/WebSocket only)
packages/
  shared/     @hridhin-k/badger-shared    — protocol types, schemas, and constants
e2e/          @hridhin-k/badger-e2e       — black-box end-to-end tests (never published)
```

- `apps/` contains deployable applications. They are never imported by other workspaces.
- `packages/` contains internal libraries consumed by the apps.
- The dependency graph is enforced by TypeScript project references: `cli → shared ← server`.
- The Dashboard communicates **only** through the server's public REST and WebSocket APIs.
  It must never import server internals or share runtime state with the server.

## Prerequisites

- Node.js >= 20
- pnpm >= 9

## Install the CLI (GitHub Packages)

Packages publish to GitHub Packages under `@hridhin-k/*`. Auth is required even
for public packages. Create a PAT with `read:packages`, then add to `~/.npmrc`:

```ini
@hridhin-k:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_PAT
```

```bash
npm install -g @hridhin-k/badger-cli
badger 3000
```

The deprecated `looplink` command is installed as an alias and prints a warning.

See [docs/publishing.md](docs/publishing.md) to publish new versions.

## Commands

Copy-paste commands for local run, production CLI use, package install/publish,
and Railway/Cloudflare deploys: [COMMANDS.md](COMMANDS.md).

## Authentication

Badger uses browser-based OAuth via Supabase Auth. After installing the CLI, log
in once:

```bash
badger login
```

A browser window opens, you complete OAuth with your provider (Google by
default), and the session is saved to `~/.config/badger/auth.json` with
permissions `0600`. The access token is transparently refreshed on expiry — you
never need to log in again unless you explicitly log out.

For CI/CD, create a workspace API key in the dashboard and authenticate without
a browser:

```bash
badger login --token bgk_...
```

API keys are stored hashed server-side; only a public prefix is retained for
display. The CLI never receives a refreshable JWT for key-based login.

### Commands

| Command                        | Description                                      |
| ------------------------------ | ------------------------------------------------ |
| `badger login`                 | Authenticate via browser OAuth                   |
| `badger login --token <key>`   | Authenticate with a workspace API key (CI/CD)    |
| `badger logout`                | Revoke refresh tokens and clear local session    |
| `badger whoami`                | Print the current authenticated user             |
| `badger <port> -w <workspace>` | Open a tunnel in a specific workspace (id/name)  |

### Token lifecycle

- The CLI stores `accessToken`, `refreshToken`, and `expiresAt` locally.
- Before each tunnel connection (and on reconnect), the CLI checks expiry and
  silently refreshes the token via `POST /api/v1/auth/refresh`.
- The access token is attached to the WebSocket upgrade as
  `Authorization: Bearer <token>`.
- The server validates the token before admitting the tunnel connection.

### Backward compatibility

Connecting without an `Authorization` header is still allowed. The server only
rejects connections that supply a malformed or invalid token. Existing
unauthenticated setups continue to work.

### Server environment variable

| Variable                    | Default  | Description                              |
| --------------------------- | -------- | ---------------------------------------- |
| `BADGER_CLI_OAUTH_PROVIDER` | `google` | Supabase OAuth provider offered to the CLI |

## Getting started (monorepo)

```bash
pnpm install
```

## Scripts

Run from the repository root:

| Script                  | Description                                    |
| ----------------------- | ---------------------------------------------- |
| `pnpm build`            | Incremental build of all workspaces (`tsc -b`) |
| `pnpm typecheck`        | Type-check without emitting                    |
| `pnpm lint`             | Lint all workspaces                            |
| `pnpm lint:fix`         | Lint and auto-fix                              |
| `pnpm format`           | Format with Prettier                           |
| `pnpm format:check`     | Verify formatting                              |
| `pnpm test`             | Unit tests for shared, server, and CLI         |
| `pnpm test:e2e`         | Build, then run the end-to-end suite           |
| `pnpm publish:cli`      | Build and publish shared + CLI to GH Packages  |
| `pnpm changeset`        | Add a release note + bump intent               |
| `pnpm version-packages` | Apply version bumps from changesets            |
| `pnpm release`          | Publish versioned packages via Changesets      |
| `pnpm clean`            | Remove build output                            |

## Testing

Unit tests live next to the code they cover (`*.spec.ts`) and run with
`pnpm test`. The end-to-end suite boots the built server and CLI as real
processes, tunnels traffic to a sample Express app, and verifies JSON, HTML,
headers, cookies, binary payloads, streaming, heartbeat, and reconnect:

```bash
pnpm test:e2e
```

See [e2e/README.md](e2e/README.md) for how the harness works.

## Automated versioning and publishing

Badger uses [Changesets](https://github.com/changesets/changesets) for monorepo
versioning:

1. Add a changeset in feature branches:
   ```bash
   pnpm changeset
   ```
2. Merge to `main`.
3. GitHub Actions (`.github/workflows/release.yml`) either:
   - opens/updates a release PR with version bumps, or
   - publishes changed packages to GitHub Packages when a release PR is merged.

## Docker (server)

The tunnel server ships with a multi-stage `Dockerfile` and Compose overlays.
**Port 8080/tcp** carries HTTP (`/health`, public tunnel traffic) and the CLI
WebSocket on the same listener — there is no separate WS port.

```bash
# Development
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

# Production
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Full port table, environment variables, and image stages:
[docker/README.md](docker/README.md). Host-side overrides: [.env.example](.env.example).

TLS edge proxy (wildcard subdomains, WebSocket, Let's Encrypt):
[docker/nginx/nginx.conf](docker/nginx/nginx.conf).

## Railway

Production deploys use Docker via [`railway.json`](railway.json). Set service
variables in the Railway dashboard (never commit secrets):

- `BADGER_PUBLIC_BASE_DOMAIN` — your Railway service hostname
- `BADGER_PUBLIC_URL_MODE=path` — recommended on Railway

See [docs/railway.md](docs/railway.md).

## Cloudflare (dashboard)

The Next.js dashboard deploys with OpenNext to a Cloudflare Worker. Connect this
GitHub repo under **Workers → Builds** so pushes to `main` auto-deploy.

Custom domain: `https://dashboard.wybrand.in` (same zone pattern as
`tunnel.wybrand.in` on Railway).

See [docs/cloudflare-dashboard.md](docs/cloudflare-dashboard.md).

## Environment variables

Prefer `BADGER_*` names. Deprecated `LOOPLINK_*` aliases remain supported for
`PUBLIC_BASE_DOMAIN`, `PUBLIC_URL_MODE`, and `SERVER_URL`. When both are set,
`BADGER_*` wins. See [docs/migration.md](docs/migration.md).

## EventBus

Lifecycle observability uses a typed in-process EventBus in
`@hridhin-k/badger-shared` (Nest `EventModule` provides `EVENT_BUS`). See
[docs/event-bus.md](docs/event-bus.md). Tunnel protocol and forwarding are
unchanged.

## Storage

Phase 2 modules persist data through a backend-agnostic `StorageProvider`
(default: in-memory). See [docs/storage.md](docs/storage.md). Feature code must
not depend on a concrete backend.

## TrafficRecorder

HTTP exchanges are recorded by an EventBus subscriber (`TrafficRecorder`) that
persists through `StorageProvider`. It never touches forwarding. See
[docs/traffic-recorder.md](docs/traffic-recorder.md).

## Tooling

- **TypeScript** in strict mode (plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  and friends) configured once in `tsconfig.base.json` and extended by every workspace.
- **ESLint 9** flat config with type-checked `typescript-eslint` rules.
- **Prettier** owns all formatting; `eslint-config-prettier` disables conflicting ESLint rules.
- **EditorConfig** keeps whitespace and encoding consistent across editors.

## License

MIT
