# Publishing the CLI to GitHub Packages

GitHub Packages requires the npm scope to match the GitHub owner (org or user).
Packages are:

1. `@hridhin-k/badger-shared`
2. `@hridhin-k/badger-cli` (depends on shared; provides the `badger` and deprecated `looplink` binaries)

Registry: `https://npm.pkg.github.com`

> **Note:** Publishing uses the `@hridhin-k/*` scope, which matches the current
> GitHub owner and avoids package create permission errors on unavailable scopes.

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

### Automated (recommended)

Publishing is automated with Changesets via `.github/workflows/release.yml`.

- Add a changeset in your PR:
  ```bash
  pnpm changeset
  ```
- Merge to `main`.
- The release workflow opens/updates a version PR.
- Merging that PR publishes changed packages automatically.

### Manual fallback

From the repository root (after `~/.npmrc` is set):

```bash
pnpm publish:cli
```

Or step by step:

```bash
pnpm build
pnpm --filter @hridhin-k/badger-shared publish
pnpm --filter @hridhin-k/badger-cli publish
```

After a successful publish, packages appear under the repository owner's
**Packages** sidebar: `https://github.com/Hridhin-k/looplink/packages`.

## Install (for teammates)

Each user needs `~/.npmrc`:

```ini
@hridhin-k:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=THEIR_GITHUB_PAT
```

Then:

```bash
npm install -g @hridhin-k/badger-cli
badger 3000
```

`read:packages` on the PAT is enough for install. If the repo (or package) is
private, they also need access to this GitHub repository/org.

### Migrating from older package names

```bash
npm uninstall -g @hridhin-k/badger
npm install -g @hridhin-k/badger-cli
```

Update any `package.json` dependencies from `@hridhin-k/badger` /
`@hridhin-k/badger-shared` to `@hridhin-k/badger-cli` / `@hridhin-k/badger-shared`.

## Version bumps

Bump **both** `packages/shared/package.json` and `apps/cli/package.json`
together. Keep the CLI dependency as `workspace:*`; pnpm rewrites it to the
real version when packing.
