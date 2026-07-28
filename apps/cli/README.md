# @hridhin-k/badger-cli

Expose any local port through a secure public HTTPS URL.

## Install (GitHub Packages)

GitHub Packages requires auth even for public packages. Create a GitHub
[Personal Access Token](https://github.com/settings/tokens) with `read:packages`
(and `write:packages` if you publish).

Add to your user `~/.npmrc`:

```ini
@hridhin-k:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_PAT
```

Then:

```bash
npm install -g @hridhin-k/badger-cli
badger 3000
```

Or one-off:

```bash
npx @hridhin-k/badger-cli 3000
```

The `looplink` binary is installed as a **deprecated alias** for one release and
prints a migration warning. Prefer `badger`.

## Usage

```bash
# Tunnel the app on localhost:3000 (uses the hosted Badger server by default)
badger 3000

# Point at a local Badger server while developing the monorepo
badger 3000 --server ws://127.0.0.1:8080

# Replay a previously recorded request (tunnel must still be connected)
badger replay <requestId> --server ws://127.0.0.1:8080
```

Or:

```bash
export BADGER_SERVER_URL=ws://127.0.0.1:8080
badger 3000
```

`LOOPLINK_SERVER_URL` is still accepted as a deprecated alias.

When ready, the CLI prints a public URL such as:

```text
https://abcd1234567890ab.badger.dev
```

or, in path mode:

```text
https://your-host.example/tunnel/<tunnelId>
```

## Migrating from LoopLink

See [docs/migration.md](../../docs/migration.md).
