# syntax=docker/dockerfile:1

# LoopLink server image.
#
# Targets:
#   production  — minimal runtime (default)
#   development — full workspace with TypeScript toolchain for local compose
#
# The server, WebSocket gateway, and public HTTP forwarding all share one TCP
# port (see PORT / EXPOSE below).

ARG NODE_VERSION=22

# ---------------------------------------------------------------------------
# Base: Node + pnpm via Corepack
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable && corepack prepare pnpm@10.18.2 --activate

WORKDIR /app

# ---------------------------------------------------------------------------
# Dependencies: install the server workspace graph (shared + server)
# ---------------------------------------------------------------------------
FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
# Lockfile integrity requires every workspace package.json to be present.
COPY apps/cli/package.json apps/cli/

RUN pnpm install --frozen-lockfile --filter @looplink/server...

# ---------------------------------------------------------------------------
# Build: compile shared + server
# ---------------------------------------------------------------------------
FROM deps AS build

COPY tsconfig.base.json tsconfig.json ./
COPY packages/shared packages/shared
COPY apps/server apps/server

RUN pnpm --filter @looplink/shared build \
  && pnpm --filter @looplink/server build

# ---------------------------------------------------------------------------
# Development: keep sources + toolchain for compose volume workflows
# ---------------------------------------------------------------------------
FROM build AS development

ENV NODE_ENV=development \
    HOST=0.0.0.0 \
    PORT=8080

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||'8080')+'/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/server/dist/main.js"]

# ---------------------------------------------------------------------------
# Deploy: self-contained production package via pnpm deploy
# ---------------------------------------------------------------------------
FROM build AS deploy

RUN pnpm --filter @looplink/server deploy --prod --legacy /deploy

# ---------------------------------------------------------------------------
# Production: slim runtime image
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS production

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080

WORKDIR /app

RUN addgroup -S looplink && adduser -S looplink -G looplink

COPY --from=deploy --chown=looplink:looplink /deploy ./

USER looplink

# TCP 8080 — HTTP (GET /health, public tunnel traffic) + WebSocket upgrades.
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||'8080')+'/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
