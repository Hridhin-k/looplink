# Badger server — Docker

Run the NestJS tunnel server in a container. The CLI stays on the host (or
another machine) and connects to the published WebSocket port.

## Quick start

```bash
# Development (rebuilds TypeScript from mounted sources on start)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

# Production (slim image, restart policy, read-only root filesystem)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Point the CLI at the published port:

```bash
pnpm cli -- 3000 --server ws://127.0.0.1:8080
# or, after building the CLI:
node apps/cli/dist/index.js 3000 --server ws://127.0.0.1:8080
# or, if linked globally:
badger 3000 --server ws://127.0.0.1:8080
```

Health check:

```bash
curl -s http://127.0.0.1:8080/health
# {"status":"ok"}
```

## Ports

Badger listens on **one TCP port**. HTTP, WebSocket upgrades, and public
tunnel forwarding all share the Fastify server.

| Port     | Published by default           | Protocol                 | Who connects                     | Purpose                                                               |
| -------- | ------------------------------ | ------------------------ | -------------------------------- | --------------------------------------------------------------------- |
| **8080** | host `8080` → container `8080` | HTTP                     | browsers, `curl`, load balancers | `GET /health`                                                         |
| **8080** | same mapping                   | HTTP                     | public clients                   | Tunnel traffic routed by `Host: {slug}.{domain}`                      |
| **8080** | same mapping                   | WebSocket (`ws` / `wss`) | `@hridhin-k/badger-cli`          | Control plane: connect, create/restore tunnel, heartbeat, HTTP frames |

There is **no separate WebSocket port**. Do not map 8080 and a second port for
WS — the upgrade happens on the same listener.

### Changing the host port

Set `PORT` in a root `.env` (see `.env.example`) or the shell. Compose maps
`${PORT:-8080}:8080`, so only the **host** side changes; the process inside the
container still binds `8080` (see `HOST` / `PORT` in `docker/*.env`).

```bash
echo 'PORT=9090' > .env
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
# CLI: --server ws://127.0.0.1:9090
```

### Container-to-container

On the Compose network `badger`, other services reach the server at:

```text
http://server:8080/health
ws://server:8080
```

## Environment variables

| Variable                         | Default                      | Used by                               | Description                                                                                                                         |
| -------------------------------- | ---------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`                           | `8080`                       | server process / compose host mapping | Process listen port inside the container (compose fixes this at `8080`). Also selects the **host** publish port when set in `.env`. |
| `HOST`                           | `0.0.0.0`                    | server process                        | Bind address. Must be `0.0.0.0` in Docker.                                                                                          |
| `BADGER_PUBLIC_BASE_DOMAIN`      | `badger.dev`                 | URL minting + `Host` parsing          | DNS suffix for tunnel URLs. Alias: `LOOPLINK_PUBLIC_BASE_DOMAIN` (deprecated; `BADGER_*` wins). Use `localhost` in development.     |
| `BADGER_PUBLIC_URL_MODE`         | `path`                       | URL minting                           | `path` or `subdomain`. Alias: `LOOPLINK_PUBLIC_URL_MODE` (deprecated).                                                              |
| `BADGER_HTTP_FORWARD_TIMEOUT_MS` | `30000`                      | HTTP forwarding                       | Max wait for the CLI to answer a forwarded request.                                                                                 |
| `NODE_ENV`                       | `production` / `development` | runtime                               | Set by the compose overlays.                                                                                                        |
| `BADGER_IMAGE_TAG`               | `latest`                     | compose prod                          | Tag for `badger-server` image.                                                                                                      |

Files:

| File                     | Role                                         |
| ------------------------ | -------------------------------------------- |
| `.env.example`           | Documented template for host-side overrides  |
| `docker/development.env` | Defaults loaded by `docker-compose.dev.yml`  |
| `docker/production.env`  | Defaults loaded by `docker-compose.prod.yml` |

## Images & stages

`Dockerfile` targets:

| Target        | Purpose                                     |
| ------------- | ------------------------------------------- |
| `development` | Full workspace + TypeScript build tooling   |
| `production`  | `pnpm deploy` output, non-root user, Alpine |

Healthchecks (image `HEALTHCHECK` and Compose `healthcheck`) call
`GET /health` on `127.0.0.1:$PORT` and expect HTTP 200.

## TLS edge (nginx)

[`docker/nginx/nginx.conf`](nginx/nginx.conf) terminates HTTPS for `badger.dev`
and `*.badger.dev`, proxies HTTP + WebSocket to the Badger upstream, and
exposes an ACME webroot for Let's Encrypt.

| Port    | Role                                                          |
| ------- | ------------------------------------------------------------- |
| **80**  | ACME HTTP-01 + redirect to HTTPS                              |
| **443** | TLS → upstream `127.0.0.1:8080` (or `server:8080` in Compose) |

Wildcard certificates need **DNS-01** (`certbot` + DNS plugin). Apex-only can
use HTTP-01 against `/.well-known/acme-challenge/`. Every directive in the
file is commented in place.

## Layout

```text
Dockerfile                 Multi-stage server image
docker-compose.yml         Shared service, ports, healthcheck, network
docker-compose.dev.yml     Development overlay (volumes, rebuild command)
docker-compose.prod.yml    Production overlay (restart, read-only, limits)
docker/development.env     Development environment
docker/production.env      Production environment
docker/nginx/nginx.conf    Edge reverse proxy (wildcard TLS, WS, ACME)
docker/README.md           This file
.env.example               Host / documentation template
.dockerignore              Build context exclusions
```
