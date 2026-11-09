---
title: CI and releases
description: The GitHub Actions workflows that check every pull request, deploy the docs site to Cloudflare Pages, and attach the release binaries and changelog.
llms: optional
sidebar:
  order: 6
---

Two workflows live in `.github/workflows/`. `ci.yml` runs on every pull request and on every push to `main`. `release.yml` runs when someone publishes a GitHub release.

## Setup action

Every job installs the toolchain with the composite action in `.github/actions/setup/action.yml`. It restores the Bun package cache, keyed on `bun.lock`, and then runs `jdx/mise-action`. mise-action trusts the checkout, installs the tools that `mise.toml` pins, and runs `mise install`, so the `postinstall` hook from [development setup](./dev-setup.md#install) runs in CI too. GitHub Actions sets `CI=true`, and the hook changes two things when `CI` is set:

- `bun install` gets `--frozen-lockfile`, so a `package.json` change without a matching `bun.lock` change fails the job.
- The hook skips the codebase-memory-mcp index.

## Pull request checks

`ci.yml` runs four jobs:

| Job | What it runs |
| --- | --- |
| `check` | `bun run check`: tests, typecheck, lint (including actionlint over these workflows and shellcheck over every tracked `.sh` file), `fmt:check`, every generator with `--check`, `deps:binaries --offline`, and `docs:lint`. |
| `e2e` | `bunx playwright install --with-deps chromium`, then `bun run test:e2e`. It uploads `tests/e2e/__screenshots__/` as the `e2e-screenshots` artifact, also when a test fails. |
| `build` | `bun run build --target linux-x64`, then `./dist/bin/aid-linux-x64 build docs --clean`. It uploads the binary as the `aid-linux-x64` artifact and `docs/dist` as the `docs-site` artifact. |
| `deploy-docs` | Runs after the three jobs above pass. It deploys the `docs-site` artifact to Cloudflare Pages. |

The `build` job builds the docs site with the binary it just compiled, not with the source CLI, so the preview shows what the compiled binary produces.

The `check`, `e2e`, and `build` jobs cancel the same jobs of an older run on the same branch. On `main`, a quick second push therefore cancels the first push's checks, and only the second push deploys. `deploy-docs` never cancels a running deploy. GitHub keeps at most one pending deploy per branch behind it, the newest.

## Docs previews

`deploy-docs` runs `wrangler pages deploy` through `cloudflare/wrangler-action`, with the Pages project `shikachuu-aid` that `PAGES_PROJECT` in `ci.yml` names.

| Event | Pages branch | URL |
| --- | --- | --- |
| Pull request `#<n>` | `pr-<n>` | `https://pr-<n>.shikachuu-aid.pages.dev` |
| Push to `main` | `main`, the production branch | `https://shikachuu-aid.pages.dev` |

wrangler-action also creates a GitHub deployment, so the pull request shows a "View deployment" button with the preview URL. The job summary lists the URL too.

Every preview keeps `base_url: https://shikachuu-aid.pages.dev` from `docs/aid.yaml`, so the absolute links in a preview's `llms.txt` point at the production site.

`deploy-docs` skips pull requests from forks and from Dependabot, because GitHub does not pass repository secrets to them.

## Releases

To release, create a tag and publish a GitHub release for it:

```sh
git tag v0.1.0
git push origin v0.1.0
gh release create v0.1.0 --title v0.1.0
```

`release.yml` then runs these steps:

1. Fails unless the tag starts with `vX.Y.Z`.
2. Runs `bun run check` on the tagged commit.
3. Sets `version` in `package.json` to the tag without its `v`. The change is never committed. `src/cli/main.ts` imports the version at compile time, so `aid --version` prints `0.1.0`.
4. Runs `bun run build`, which cross-compiles all four binaries on one Linux runner. See [single binary](./single-binary.md).
5. Checks that `aid-linux-x64 --version` prints the tag version.
6. Writes `SHA256SUMS` next to the binaries.
7. Uploads the four binaries and `SHA256SUMS` to the release with `gh release upload --clobber`, so a re-run replaces them.
8. Generates the release notes with git-cliff and replaces the release description with them.

git-cliff reads `cliff.toml`. With `--current`, it takes the commits between the release tag and the `v*` tag before it, or the whole history for the first release, drops merge commits and commits without a conventional prefix, and groups the rest under Features, Fixes, Performance, Refactors, Docs, Tests, Chores, and Other. [Conventions](./conventions.md) describes the commit prefixes. A description you write on the release is lost.

The release is public before the workflow starts. If a step fails, the release stays published without binaries or with its original description. For an outside cause, such as a GitHub outage, re-run the workflow from the Actions tab: the upload replaces existing files and the notes step rewrites the description. A re-run uses the same tagged commit, so a bug in the code or the workflow needs a fix on `main` and a new tag.

The release job turns off the mise and Bun caches. A cache that a pull request run wrote must not end up in a release binary.

## One-time setup

The workflows need these settings in the GitHub repository and the Cloudflare account:

1. Create the Pages project with `npx wrangler pages project create shikachuu-aid --production-branch main`. If Cloudflare assigns a different `*.pages.dev` subdomain, update `PAGES_PROJECT` in `ci.yml` and `base_url` in `docs/aid.yaml`.
2. Create a Cloudflare API token with the "Cloudflare Pages: Edit" permission.
3. Add the repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
4. Protect `main` and require the `check`, `e2e`, and `build` jobs.

## Action pins

Every external action is pinned to a full commit SHA, with its version in a trailing comment. `.github/dependabot.yml` checks the workflows and the setup action weekly, waits 7 days after an action release, and opens one grouped pull request.
