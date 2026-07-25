# LoopLink

Expose localhost through secure public URLs.

LoopLink is an open-source developer tool, similar to ngrok, that tunnels traffic from a public
URL to a service running on your machine.

## Repository layout

```
apps/
  cli/        @looplink/cli    — command-line client run by developers
  server/     @looplink/server — public tunnel server that relays traffic
packages/
  shared/     @looplink/shared — protocol types, schemas, and constants
```

- `apps/` contains deployable applications. They are never imported by other workspaces.
- `packages/` contains internal libraries consumed by the apps.
- The dependency graph is enforced by TypeScript project references: `cli → shared ← server`.

## Prerequisites

- Node.js >= 20
- pnpm >= 9

## Getting started

```bash
pnpm install
```

## Scripts

Run from the repository root:

| Script              | Description                                    |
| ------------------- | ---------------------------------------------- |
| `pnpm build`        | Incremental build of all workspaces (`tsc -b`) |
| `pnpm typecheck`    | Type-check without emitting                    |
| `pnpm lint`         | Lint all workspaces                            |
| `pnpm lint:fix`     | Lint and auto-fix                              |
| `pnpm format`       | Format with Prettier                           |
| `pnpm format:check` | Verify formatting                              |
| `pnpm clean`        | Remove build output                            |

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
