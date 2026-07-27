# Deploying Badger on Railway

The tunnel server deploys from the repository root using Docker. Configuration
lives in [`railway.json`](../railway.json) (no secrets, no env values).

## Build

Railway builds with:

- Builder: `DOCKERFILE`
- Dockerfile: `/Dockerfile` (production target by default)
- Watch paths: `apps/server`, `packages/shared`, lockfiles, and the Dockerfile

## Deploy

- Health check: `GET /health`
- Restart: on failure (max 10 retries)
- Replicas: 1 (in-memory tunnel state is process-local)

## Required service variables

Set these in the Railway dashboard (never commit them):

| Variable                    | Example                       | Notes                                                  |
| --------------------------- | ----------------------------- | ------------------------------------------------------ |
| `BADGER_PUBLIC_BASE_DOMAIN` | `your-service.up.railway.app` | Hostname used when minting public URLs                 |
| `BADGER_PUBLIC_URL_MODE`    | `path`                        | Use `path` on Railway (single-host TLS)                |
| `PORT`                      | Railway-provided              | Server already reads `PORT`; default image uses `8080` |
| `HOST`                      | `0.0.0.0`                     | Required so the process accepts external traffic       |

Deprecated aliases `LOOPLINK_PUBLIC_BASE_DOMAIN` and `LOOPLINK_PUBLIC_URL_MODE`
still work; prefer `BADGER_*`. See [migration.md](migration.md).

## CLI against Railway

```bash
badger 3000 --server wss://your-service.up.railway.app
# or
export BADGER_SERVER_URL=wss://your-service.up.railway.app
badger 3000
```

## Notes

- Path-based public URLs (`https://{domain}/tunnel/{tunnelId}`) do not need
  wildcard DNS or certificates.
- Do not scale to multiple replicas until tunnel state is externalized; each
  replica has its own in-memory tunnel map.
