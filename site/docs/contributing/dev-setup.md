---
title: Development setup
description: Install the pinned Bun through mise, install dependencies for every platform, and run aid from source.
llms: optional
sidebar:
  order: 1
---

aid pins its toolchain with mise. `mise.toml` pins Bun 1.4.4, and `package.json` requires Bun 1.3.6 or newer through `engines.bun`. `mise.lock` records the resolved tool versions and is committed, so every checkout and CI run installs the same Bun.

## Install

Install [mise](https://mise.jdx.dev), then run this in the repository root:

```sh
mise install
```

`mise install` installs the Bun canary that `mise.toml` pins and then runs the `postinstall` hook from `mise.toml`. The hook runs three commands in order:

1. `bun install --cpu='*' --os='*'` installs every platform subpackage of `@tailwindcss/oxide`, `@bufbuild/buf`, `lightningcss`, and `@oven/bun`, not only the ones for your machine. `scripts/compile.ts` needs all of them to cross-compile the four release binaries.
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
| `bun run gen-css-data` | `scripts/gen-css-data.ts`: regenerates `src/lint/css-data.json`, the CSS names `aid lint` knows, from the `@webref/css` and `@webref/elements` dev dependencies. Run it after bumping either package. Add `--check` to fail on drift instead of writing. |
| `bun run docs:build` | `bun src/cli/index.ts build site --clean`: builds this site into `site/dist`. |
| `bun run docs:dev` | `bun src/cli/index.ts dev site`: serves this site with live reload. |
| `bun run docs:lint` | `bun src/cli/index.ts lint site --filter md`: runs markdownlint over the site. |
| `bun run docs:affected` | `scripts/docs-affected.ts`: lists the docs pages that document the files changed since `--base` (default `origin/main`). |
| `bun run deps:binaries` | `scripts/check-binaries.ts`: checks the platform packages, the staged lightningcss bindings, and the Bun version, then reports newer upstream versions. Add `--offline` to skip the upstream lookup. |
| `bun test` | The Bun test runner over `tests/`. |
| `bun run typecheck` | `tsc --noEmit`. |
| `bun run lint` | `bun lint` over `src`, `scripts`, `tests`, and `packages`, then `aid lint . --filter css` over every CSS file. |
| `bun run fmt` | `bun fmt` over the JS, TS, JSON, and CSS files in `src`, `scripts`, `tests`, `packages`, and `site`, and the root `*.json` files. |
| `bun run gen-bunfig` | `scripts/gen-bunfig.ts`: regenerates `bunfig.toml` (lint rules) and `.prettierrc.json` (format options) from the bundled defaults plus the repo settings. Add `--check` to fail on drift instead of writing. |

[Docs site](./docs-site.md) covers the `docs:*` and `gen-docs` scripts in detail.

## Check the binaries and the runtime

aid embeds native binaries from npm packages, and each platform's package must match its parent. `bun run deps:binaries` checks these groups:

| Group | Must match |
| --- | --- |
| `@bufbuild/buf` | The four `@bufbuild/buf-<platform>` pins in `package.json` and their installed versions. |
| `@tailwindcss/oxide` | The four `@tailwindcss/oxide-<platform>` pins in `package.json` and their installed versions. |
| `lightningcss` | The exact version that `@tailwindcss/node` declares, for aid's own `lightningcss` pin in `package.json`, the installed `lightningcss`, and its four platform packages. |
| Bun runtime | The four `@oven/bun-<platform>` pins in `package.json`, which must equal the `mise.toml` pin. `scripts/compile.ts` passes each one to `Bun.build` as the target's runtime, because cross-compiling a canary would otherwise download the stable runtime. |
| Bun | The running Bun, the `mise.toml` pin, `engines.bun` (against the pin's base version), and the major and minor version of `@types/bun`. A canary reports only its base version, so for a canary pin the running binary must match the host's `@oven/bun-<platform>` binary byte for byte. |

It also compares each `vendor/natives/lightningcss-<platform>.bin` with its source in `node_modules`. Any mismatch prints a `drift:` list and exits with code 1.

Without `--offline`, the script then looks up the latest version of each group on the npm registry, and of Bun with `mise latest bun`. For each outdated group, it prints the `bun add` commands that bump the parent and pin every platform package to the same exact version. The script never edits `package.json`.

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
