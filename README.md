# Badger

Expose localhost through secure public URLs.

Badger is an open-source developer tool, similar to ngrok, that tunnels traffic from a public
URL to a service running on your machine.

## Repository layout

```
apps/
  cli/        @hridhin-k/badger          — command-line client run by developers
  server/     @hridhin-k/badger-server   — public tunnel server that relays traffic
  dashboard/  @hridhin-k/badger-dashboard — Next.js dashboard (Phase 2 scaffold)
packages/
  shared/     @hridhin-k/badger-shared — protocol types, schemas, constants, EventBus
e2e/          @hridhin-k/badger-e2e   — black-box end-to-end tests (never published)
```

- `apps/` contains deployable applications. They are never imported by other workspaces.
- `packages/` contains internal libraries consumed by the apps.
- The dependency graph is enforced by TypeScript project references for the
  tunnel stack: `cli → shared ← server`. The dashboard depends on `shared` via
  the workspace package and talks to the server only over public REST/WebSocket APIs.

Internal lifecycle observability uses a typed EventBus in shared. See
[docs/event-bus.md](docs/event-bus.md). Dashboard scaffolding notes:
[docs/dashboard.md](docs/dashboard.md).

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
npm install -g @hridhin-k/badger
badger 3000
```

See [docs/publishing.md](docs/publishing.md) to publish new versions.

## Getting started (monorepo)

```bash
pnpm install
```

## Scripts

Run from the repository root:

| Script               | Description                                            |
| -------------------- | ------------------------------------------------------ |
| `pnpm build`         | Build shared/cli/server (`tsc -b`), then the dashboard |
| `pnpm build:tsc`     | Incremental TypeScript build of tunnel workspaces      |
| `pnpm typecheck`     | Type-check tunnel workspaces + dashboard               |
| `pnpm lint`          | Lint all workspaces                                    |
| `pnpm lint:fix`      | Lint and auto-fix                                      |
| `pnpm format`        | Format with Prettier                                   |
| `pnpm format:check`  | Verify formatting                                      |
| `pnpm test`          | Unit tests (shared, server, CLI, dashboard)            |
| `pnpm test:e2e`      | Build tunnel stack, then run the end-to-end suite      |
| `pnpm dashboard:dev` | Run the Next.js dashboard on port 3001                 |
| `pnpm publish:cli`   | Build and publish shared + CLI to GH Packages          |
| `pnpm clean`         | Remove build output                                    |

## Testing

Unit tests live next to the code they cover (`*.spec.ts`) and run with
`pnpm test`. The end-to-end suite boots the built server and CLI as real
processes, tunnels traffic to a sample Express app, and verifies JSON, HTML,
headers, cookies, binary payloads, streaming, heartbeat, and reconnect:

```bash
pnpm test:e2e
```

See [e2e/README.md](e2e/README.md) for how the harness works.

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

## Tooling

- **TypeScript** in strict mode (plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  and friends) configured once in `tsconfig.base.json` and extended by every workspace.
- **ESLint 9** flat config with type-checked `typescript-eslint` rules.
- **Prettier** owns all formatting; `eslint-config-prettier` disables conflicting ESLint rules.
- **EditorConfig** keeps whitespace and encoding consistent across editors.

## License

MIT
