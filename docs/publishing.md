# Publishing the CLI to GitHub Packages

GitHub Packages requires the npm scope to match the GitHub owner. Packages are:

1. `@hridhin-k/badger-shared`
2. `@hridhin-k/badger` (depends on shared; provides the `badger` binary)

Registry: `https://npm.pkg.github.com`

## One-time setup

1. Create a GitHub Personal Access Token (classic) with:
   - `write:packages`
   - `read:packages`
   - `repo` (needed if the repository is private)

2. Add auth to your user `~/.npmrc` (never commit this):

```ini
@hridhin-k:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=ghp_your_token_here
```

The repo `.npmrc` already maps `@hridhin-k` → GitHub Packages; the token
must live in your user config (or CI secrets).

## Publish

From the repository root (after `~/.npmrc` is set):

```bash
pnpm publish:cli
```

Or step by step:

```bash
pnpm build
pnpm --filter @hridhin-k/badger-shared publish
pnpm --filter @hridhin-k/badger publish
```

After a successful publish, packages appear under the GitHub repo’s
**Packages** sidebar: https://github.com/Hridhin-k/looplink/packages

## Install (for teammates)

Each user needs `~/.npmrc`:

```ini
@hridhin-k:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=THEIR_GITHUB_PAT
```

Then:

```bash
npm install -g @hridhin-k/badger
badger 3000
```

`read:packages` on the PAT is enough for install. If the repo (or package) is
private, they also need access to this GitHub repository/org.

## Version bumps

Bump **both** `packages/shared/package.json` and `apps/cli/package.json`
together. Keep the CLI dependency as `workspace:*`; pnpm rewrites it to the
real version when packing.
