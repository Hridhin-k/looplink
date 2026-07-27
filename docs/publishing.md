# Publishing the CLI to GitHub Packages

GitHub Packages requires the npm scope to match the GitHub owner (org or user).
Packages are:

1. `@badger/shared`
2. `@badger/cli` (depends on shared; provides the `badger` and deprecated `looplink` binaries)

Registry: `https://npm.pkg.github.com`

> **Note:** Publishing under `@badger/*` requires a GitHub organization or user
> named `badger` (or a linked package namespace). Create that org (or transfer
> packages) before the first publish. Until then, local workspace installs work
> without publishing.

## One-time setup

1. Create a GitHub Personal Access Token (classic) with:
   - `write:packages`
   - `read:packages`
   - `repo` (needed if the repository is private)

2. Add auth to your user `~/.npmrc` (never commit this):

```ini
@badger:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=ghp_your_token_here
```

The repo `.npmrc` already maps `@badger` → GitHub Packages; the token
must live in your user config (or CI secrets).

## Publish

From the repository root (after `~/.npmrc` is set):

```bash
pnpm publish:cli
```

Or step by step:

```bash
pnpm build
pnpm --filter @badger/shared publish
pnpm --filter @badger/cli publish
```

After a successful publish, packages appear under the GitHub owner's
**Packages** sidebar (for example `https://github.com/orgs/badger/packages`).

## Install (for teammates)

Each user needs `~/.npmrc`:

```ini
@badger:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=THEIR_GITHUB_PAT
```

Then:

```bash
npm install -g @badger/cli
badger 3000
```

`read:packages` on the PAT is enough for install. If the repo (or package) is
private, they also need access to this GitHub repository/org.

### Migrating from `@hridhin-k/badger*`

```bash
npm uninstall -g @hridhin-k/badger
npm install -g @badger/cli
```

Update any `package.json` dependencies from `@hridhin-k/badger` /
`@hridhin-k/badger-shared` to `@badger/cli` / `@badger/shared`.

## Version bumps

Bump **both** `packages/shared/package.json` and `apps/cli/package.json`
together. Keep the CLI dependency as `workspace:*`; pnpm rewrites it to the
real version when packing.
