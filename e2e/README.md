# LoopLink end-to-end tests

Black-box tests that exercise the **built** LoopLink server and CLI as real
child processes, with a sample Express app playing the developer's local
service. Every request travels the full production path:

```
test (undici) ──HTTP──▶ server (public host) ──WebSocket──▶ CLI ──HTTP──▶ Express app
      ◀────────────────────── streamed response ◀──────────────────────────┘
```

## What is covered

| Scenario      | Test                                                                         |
| ------------- | ---------------------------------------------------------------------------- |
| Tunnel create | CLI prints a `https://<slug>.looplink.test` URL after connecting             |
| JSON          | `GET /api/data` round-trips a JSON document                                  |
| HTML          | `GET /` round-trips an HTML page with `text/html`                            |
| Headers       | Custom request header reaches the app; custom response header comes back     |
| Cookies       | `Cookie` reaches the app; multiple `Set-Cookie` values return intact         |
| Request body  | `POST /echo` round-trips a JSON payload plus query parameters                |
| Binary        | 150 kB deterministic payload returns byte-for-byte (spans several WS chunks) |
| Streaming     | Chunked `/stream` response arrives complete, with no `Content-Length`        |
| Heartbeat     | A raw WebSocket `ping` receives a `pong` with the matching `requestId`       |
| Reconnect     | Server is SIGKILLed and restarted; the CLI reconnects and forwarding resumes |
| Path routing  | `LOOPLINK_PUBLIC_URL_MODE=path` serves `/tunnel/{id}/...` (Railway-style)    |

## Running the suite

From the repository root:

```bash
pnpm install
pnpm test:e2e        # builds all workspaces, then runs the suite
```

`pnpm test:e2e` always rebuilds first because the suite spawns
`apps/server/dist/main.js` and `apps/cli/dist/index.js`. To iterate on the
tests without rebuilding:

```bash
pnpm --filter @looplink/e2e test         # single run
pnpm --filter @looplink/e2e test:watch   # watch mode
```

## How the harness works

- **Sample app** (`src/support/sample-app.ts`) — an Express server that
  prefers port **3000** and falls back to an ephemeral port when 3000 is
  taken, so the suite can run next to a dev server.
- **Server** — spawned with an ephemeral `PORT`,
  `LOOPLINK_PUBLIC_BASE_DOMAIN=looplink.test`, and raised rate limits so the
  tests exercise forwarding rather than the security throttles (those are
  covered by unit tests). Host-based tests force
  `LOOPLINK_PUBLIC_URL_MODE=subdomain`; path-based tests use `path`.
- **CLI** — spawned as `looplink <appPort> --server ws://127.0.0.1:<port>`;
  the public URL is parsed from its output.
- **Public requests** — `*.looplink.test` does not resolve in DNS, so requests
  target `127.0.0.1:<serverPort>` directly with the public hostname in the
  `Host` header. Path-mode requests hit `/tunnel/{id}/...` on the apex host;
  subdomain-mode requests use the tunnel hostname (as nginx would).

Two spec files run sequentially (`fileParallelism` disabled). The Host-based
suite shares one server/CLI/app fixture (reconnect kills the server last). The
path-based suite boots its own stack with `LOOPLINK_PUBLIC_URL_MODE=path`.

## Notes

- The heartbeat test validates the protocol's ping/pong exchange against the
  live server. The CLI's own 30-second heartbeat cadence and the server's
  60-second idle disconnect are unit-tested (`apps/cli`, `apps/server`)
  because waiting out those intervals would make the suite needlessly slow.
- Each test has a 60-second timeout; the whole suite normally finishes in
  under 10 seconds.
