# @hridhin-k/badger

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
npm install -g @hridhin-k/badger
badger 3000
```

Or one-off:

```bash
npx @hridhin-k/badger 3000
```

## Usage

```bash
# Tunnel the app on localhost:3000 (uses the hosted Badger server by default)
badger 3000

# Point at a local Badger server while developing the monorepo
badger 3000 --server ws://127.0.0.1:8080
```

Or:

```bash
export BADGER_SERVER_URL=ws://127.0.0.1:8080
badger 3000
```

When ready, the CLI prints a public URL such as:

```text
https://<slug>.tunnel.wybrand.in → http://localhost:3000
```

Press `Ctrl+C` to stop.

## Tips for web apps

Dev servers with HMR (Next.js `next dev`, Vite `vite dev`) open a browser
WebSocket that Badger does not tunnel yet. For demos, prefer:

```bash
npx next build && npx next start -p 3000
# or
npx vite build && npx vite preview --host 127.0.0.1 --port 3000
```

Then run `badger 3000`.

## License

MIT
