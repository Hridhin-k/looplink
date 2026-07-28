# Migration guide: LoopLink → Badger

This release rebrands **LoopLink v0.x** to **Badger v1.0**. Tunnel protocol,
networking behavior, and business logic are unchanged. Existing deployments
keep working when you apply the aliases below.

## Summary

| Area                   | LoopLink (legacy)                              | Badger (canonical)                                                              |
| ---------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------- |
| Product name           | LoopLink                                       | Badger                                                                          |
| CLI command            | `looplink`                                     | `badger` (`looplink` kept as alias)                                             |
| npm packages           | `@hridhin-k/badger*`, historical `@looplink/*` | `@hridhin-k/badger-cli`, `@hridhin-k/badger-server`, `@hridhin-k/badger-shared` |
| Public base domain env | `LOOPLINK_PUBLIC_BASE_DOMAIN`                  | `BADGER_PUBLIC_BASE_DOMAIN`                                                     |
| Public URL mode env    | `LOOPLINK_PUBLIC_URL_MODE`                     | `BADGER_PUBLIC_URL_MODE`                                                        |
| CLI server URL env     | `LOOPLINK_SERVER_URL`                          | `BADGER_SERVER_URL`                                                             |

## CLI

Install the new package:

```bash
npm uninstall -g @hridhin-k/badger
npm install -g @hridhin-k/badger-cli
```

Primary command:

```bash
badger 3000
```

Deprecated alias (prints a warning; removed in a future major release):

```bash
looplink 3000
```

## Environment variables

Internally the server and CLI prefer `BADGER_*`.

If both `BADGER_*` and `LOOPLINK_*` are set for the same setting, **`BADGER_*` wins**.

If only a `LOOPLINK_*` variable is set, Badger still honors it and logs:

```text
[badger] LOOPLINK_PUBLIC_BASE_DOMAIN is deprecated; use BADGER_PUBLIC_BASE_DOMAIN instead. ...
```

### Supported aliases

| Canonical                   | Deprecated alias              |
| --------------------------- | ----------------------------- |
| `BADGER_PUBLIC_BASE_DOMAIN` | `LOOPLINK_PUBLIC_BASE_DOMAIN` |
| `BADGER_PUBLIC_URL_MODE`    | `LOOPLINK_PUBLIC_URL_MODE`    |
| `BADGER_SERVER_URL`         | `LOOPLINK_SERVER_URL`         |

Other `BADGER_*` security and timeout variables do not have LoopLink aliases;
they were introduced under the Badger name.

### Recommended Railway / compose update

```bash
# Before
LOOPLINK_PUBLIC_BASE_DOMAIN=your-service.up.railway.app
LOOPLINK_PUBLIC_URL_MODE=path

# After
BADGER_PUBLIC_BASE_DOMAIN=your-service.up.railway.app
BADGER_PUBLIC_URL_MODE=path
```

You may keep the old names temporarily; migrate when convenient.

## Packages (monorepo / dependents)

| Legacy                     | Current                    |
| -------------------------- | -------------------------- |
| `@hridhin-k/badger`        | `@hridhin-k/badger-cli`    |
| `@hridhin-k/badger-server` | `@hridhin-k/badger-server` |
| `@hridhin-k/badger-shared` | `@hridhin-k/badger-shared` |
| `@hridhin-k/badger-e2e`    | `@hridhin-k/badger-e2e`    |

Update imports and `pnpm` / `npm` filters accordingly.

## What did not change

- WebSocket tunnel protocol message types and framing
- HTTP forward chunk protocol
- Public URL shapes (`/tunnel/{id}` and subdomain modes)
- Health endpoint `GET /health`
- Single-port HTTP + WebSocket listener (default `8080`)

## Dashboard

`apps/dashboard` (`@hridhin-k/badger-dashboard`) is a standalone Next.js 16 app. It must
not import `@hridhin-k/badger-server` internals. Integration with the tunnel server is
only via public REST and WebSocket APIs (Phase 2).
