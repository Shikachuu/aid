---
title: Release and CI
description: What the CI, docs, and release workflows in .github/workflows run, and the known problems in the release workflow.
llms: optional
sidebar:
  order: 6
---

aid has three GitHub Actions workflows in `.github/workflows/`: `ci.yml` checks every change, `docs.yml` publishes this site, and `release.yml` builds the release binaries.

## CI

`ci.yml` runs on every pull request and on every push to `main`. One job, `check`, runs on `ubuntu-latest` with a 15-minute timeout. It checks out the code with `fetch-depth: 2`, sets up mise with `jdx/mise-action` (which runs `mise install`, so Bun and every platform package match a local setup), and then runs these steps in order:

| Step | Command | Fails when |
| --- | --- | --- |
| Typecheck | `bun run typecheck` | `tsc --noEmit` reports an error. |
| Lint | `bun run lint` | `biome check .` reports an error. |
| Test | `bun test` | A test fails. |
| Binary and runtime drift | `bun run deps:binaries --offline` | A platform package, a staged lightningcss binding, or the Bun version does not match. [Development setup](./dev-setup.md#check-the-binaries-and-the-runtime) lists the checks. |
| Schema parity | `bun run scripts/emit-schema.ts --check` | `schemas/aid.schema.json` differs from the Zod schema. |
| Docs reference parity | `bun run gen-docs --check` | A file under `site/docs/reference/` or `site/static/schemas/` differs from what `scripts/gen-docs.ts` generates. |
| Build docs site | `bun run docs:build` | aid fails to build `site/`, for example on a broken link or anchor. |
| Lint docs | `bun run docs:lint` | markdownlint reports an error in `site/`. |
| Docs pages to review | `bun run docs:affected --base HEAD^1 --github` | Never. It runs on pull requests only. |

The last step prints GitHub `::notice` annotations. Each one names a docs page whose mapped source files changed, or a changed source file that no page maps. It always exits 0. On a pull request, the checked-out commit is the merge commit, so `HEAD^1` is the tip of the base branch. That is why the checkout fetches two commits. [Docs site](./docs-site.md) explains `docs:affected` and `DOCS_MAP`.

To fix a parity failure, run `bun run emit-schema` or `bun run gen-docs` and commit the result.

## Docs

`docs.yml` runs on every push to `main` and on manual dispatch. Its concurrency group `pages` never cancels a run in progress.

1. The `build` job checks out the code, sets up mise, runs `actions/configure-pages`, runs `bun run docs:build`, and uploads `site/dist` with `actions/upload-pages-artifact`.
2. The `deploy` job runs `actions/deploy-pages` in the `github-pages` environment, with `pages: write` and `id-token: write` permissions.

[GitHub Pages deployment](../deployment/github-pages.md) covers the same setup for any aid site.

## Release

`release.yml` runs when a tag that matches `v*` is pushed.

1. The `build` job runs a four-entry matrix: `bun-darwin-x64` on `macos-13`, `bun-darwin-arm64` on `macos-14`, and `bun-linux-x64` and `bun-linux-arm64` on `ubuntu-latest`. Each job installs Bun with `oven-sh/setup-bun`, runs `bun install --frozen-lockfile` and `bun run scripts/compile.ts`, and uploads `dist/bin/` as the artifact `aid-<target>`.
2. The `publish` job downloads every artifact into `dist/bin/` and creates a GitHub release with `softprops/action-gh-release`, attaching `dist/bin/*` and `schemas/aid.schema.json`. It then runs `bun publish --access public` with the `NPM_TOKEN` secret.

> [!WARNING]
> `release.yml` has known bugs and is not fixed yet. `.claude/cleanup/README.md` and `.claude/cleanup/ponytail/slice-A-core-cli-scripts.md` list them:
>
> - It installs Bun with `bun-version: latest`, not the 1.4.4 that `mise.toml` pins.
> - It skips mise and runs `bun install --frozen-lockfile`. That install omits the other platforms' packages, and `scripts/stage-natives.ts` never runs, so the `vendor/natives/*.bin` imports that `src/core/internal/lightningcss-native.ts` needs are missing.
> - `scripts/compile.ts` ignores `matrix.target` and compiles all four targets, so every matrix job builds the same four binaries and uploads them under the same file names.
> - `bun publish` fails, because the root `package.json` sets `"private": true`.
