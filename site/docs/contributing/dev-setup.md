---
title: Development setup
description: Install the pinned Bun through mise, install dependencies for every platform, and run aid from source.
llms: optional
sidebar:
  order: 1
---

aid pins its toolchain with mise. `mise.toml` pins Bun 1.3.13, and `package.json` requires Bun 1.3.6 or newer through `engines.bun`. `mise.lock` records the resolved tool versions and is committed, so every checkout and CI run installs the same Bun.

## Install

Install [mise](https://mise.jdx.dev), then run this in the repository root:

```sh
mise install
```

`mise install` installs Bun 1.3.13 and then runs the `postinstall` hook from `mise.toml`. The hook runs three commands in order:

1. `bun install --cpu='*' --os='*'` installs every platform subpackage of `@tailwindcss/oxide`, `@bufbuild/buf`, and `lightningcss`, not only the ones for your machine. `scripts/compile.ts` needs all of them to cross-compile the four release binaries.
2. `bun scripts/stage-natives.ts` copies each `lightningcss-<platform>` `.node` binding to `vendor/natives/lightningcss-<platform>.bin`. See [single binary](./single-binary.md) for why the extension changes.
3. `bun run -F @aid/proto-ui build` builds `packages/proto-ui/dist`, which holds the `styles.css` that aid serves on proto pages.

`mise.toml` also sets `experimental = true` under `[settings]`.

> [!IMPORTANT]
> Never run a bare `bun install`. It installs only the platform packages that match your machine and prints no warning. The compile pipeline then fails on the missing packages, and `vendor/natives/` stays empty. Run `mise install` after every pull that changes `package.json` or `bun.lock`.

To add a dependency, run `bun add <pkg>` to update `package.json`, then `mise install` to install it with the right flags. [Conventions](./conventions.md) lists the dependency rules.

## Package scripts

| Command | What it runs |
| --- | --- |
| `bun run build` | `scripts/compile.ts`: emits the schema, bundles the browser runtime, and compiles the four release binaries into `dist/bin/`. |
| `bun run emit-schema` | `scripts/emit-schema.ts`: writes `schemas/aid.schema.json` from the Zod schema in `src/core/config.ts`. |
| `bun run gen-docs` | `scripts/gen-docs.ts`: regenerates `site/docs/reference/**` and `site/static/schemas/aid.schema.json`. Add `--check` to fail on drift instead of writing. |
| `bun run docs:build` | `bun src/cli/index.ts build site --clean`: builds this site into `site/dist`. |
| `bun run docs:dev` | `bun src/cli/index.ts dev site`: serves this site with live reload. |
| `bun run docs:lint` | `bun src/cli/index.ts lint site --filter md`: runs markdownlint over the site. |
| `bun run docs:affected` | `scripts/docs-affected.ts`: lists the docs pages that document the files changed since `--base` (default `origin/main`). |
| `bun test` | The Bun test runner over `tests/`. |
| `bun run typecheck` | `tsc --noEmit`. |
| `bun run lint` | `biome check .`. |
| `bun run fmt` | `biome format --write .`. |

[Docs site](./docs-site.md) covers the `docs:*` and `gen-docs` scripts in detail.

## Run the CLI from source

`src/cli/index.ts` is the CLI entry point. Bun runs the TypeScript directly, with no build step:

```sh
bun src/cli/index.ts build tests/fixtures/sample-site
bun src/cli/index.ts dev site
```

From a source checkout, aid bundles the browser runtime with `Bun.build` on every build, so edits under `src/web` show up on the next build. The [CLI reference](../reference/cli.md) lists every command and flag.

## Smoke-test the compiled binary

`scripts/manual-test.ts` checks the release binary end to end:

```sh
bun scripts/manual-test.ts
```

It runs `bun run build`, then runs `dist/bin/aid-<os>-<arch>` for the host with `build` inside `tests/fixtures/sample-site`. It serves `tests/fixtures/sample-site/dist` on `http://localhost:3000/` with the dev server's `serveFile`. The build overwrites `src/web/_bundled.ts`, so restore it before you commit (see [single binary](./single-binary.md)).
