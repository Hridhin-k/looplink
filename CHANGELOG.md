# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-07-28

### Changed

- **Product rebrand:** LoopLink → **Badger** across user-facing text, docs, Docker labels, and package metadata.
- **npm scopes:** workspace packages use owned GitHub scope with Badger naming:
  - `@hridhin-k/badger` → `@hridhin-k/badger-cli`
  - `@hridhin-k/badger-server` (unchanged)
  - `@hridhin-k/badger-shared` (unchanged)
  - `@hridhin-k/badger-e2e` (unchanged)
  - `dashboard` → `@hridhin-k/badger-dashboard`
- **CLI package version** `@hridhin-k/badger-cli` and `@hridhin-k/badger-shared` set to `1.0.0`.
- **GitHub Packages registry** mapping in `.npmrc` remains `@hridhin-k` to match publish ownership.
- **Root scripts / Docker / compose filters** updated to the new package names.
- **Documentation** (README, CLI README, Docker, publishing) updated for Badger branding and `@hridhin-k/badger-*` install paths.

### Added

- **CLI binary alias:** `looplink` remains installed alongside `badger` for one release and prints a deprecation warning when invoked.
- **Environment aliases** (canonical `BADGER_*` preferred; `BADGER_*` wins when both are set; deprecation warning when only legacy is set):
  - `LOOPLINK_PUBLIC_BASE_DOMAIN` → `BADGER_PUBLIC_BASE_DOMAIN`
  - `LOOPLINK_PUBLIC_URL_MODE` → `BADGER_PUBLIC_URL_MODE`
  - `LOOPLINK_SERVER_URL` → `BADGER_SERVER_URL`
- Shared helper `resolveEnvPreferringBadger` in `@hridhin-k/badger-shared`.
- **`railway.json`** for Dockerfile-based Railway deploys (health check `/health`, no secrets).
- Docs: [docs/migration.md](docs/migration.md), [docs/railway.md](docs/railway.md).
- OCI image labels on the Badger server Dockerfile (`org.opencontainers.image.*`).

### Preserved

- Tunnel WebSocket protocol and HTTP forwarding behavior unchanged.
- Public URL shapes (`path` and `subdomain` modes) unchanged.
- `GET /health` and single-port HTTP+WS listener unchanged.
- Dashboard remains a standalone Next.js app with no server-internal imports.

### Deprecated

- `looplink` CLI command (use `badger`).
- `LOOPLINK_PUBLIC_BASE_DOMAIN`, `LOOPLINK_PUBLIC_URL_MODE`, `LOOPLINK_SERVER_URL`.
- Legacy package names `@hridhin-k/badger*`.

[1.0.0]: https://github.com/Hridhin-k/looplink/releases/tag/v1.0.0
