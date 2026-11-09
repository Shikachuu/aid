---
title: Installation
description: Install aid from source with mise, then run it from source or compile the single-file binaries.
sidebar:
  order: 1
---

aid has no published release: the repository has no tags and no downloadable binaries. Install it from a checkout of the source.

## Requirements

- git
- [mise](https://mise.jdx.dev), which installs the pinned Bun version

`mise.toml` pins the Bun canary `1.4.4-canary.20261103.1`. `package.json` requires that build or newer.

## Set up the checkout

```sh
git clone https://github.com/Shikachuu/aid.git
cd aid
mise trust
mise install
```

`mise trust` marks the repository's `mise.toml` as trusted. mise does not apply an untrusted config file and reports an error instead.

Run `mise install`, not `bun install`. `mise install` installs the pinned Bun and codebase-memory-mcp, which Claude Code uses (see [development setup](../contributing/dev-setup.md#mcp-servers-for-claude-code)). It then runs the `postinstall` hook from `mise.toml`, which runs four commands:

1. `bun install --cpu='*' --os='*'` installs the dependencies for every platform. The flags pull in the native packages of `@tailwindcss/oxide` and `@bufbuild/buf` for every operating system and CPU, which the cross-compile step needs. A bare `bun install` skips the packages for other platforms without a warning.
2. `bun scripts/stage-natives.ts` copies each platform's lightningcss `.node` binding to `vendor/natives/` with a `.bin` extension, so the compiled binary can embed it.
3. `bun run -F @aid/proto-ui build` builds the `packages/proto-ui` workspace package, which renders Protobuf pages in the browser.
4. `codebase-memory-mcp cli index_repository` indexes the checkout for Claude Code. The index goes to `~/.cache/codebase-memory-mcp/`, not into the checkout.

Run `mise install` again after you pull changes to `package.json` or `bun.lock`.

## Run from source

Inside the checkout, run the CLI entry point with Bun and pass the project folder as an argument:

```sh
bun src/cli/index.ts build ../my-docs
bun src/cli/index.ts dev ../my-docs
```

mise selects the pinned Bun only inside the checkout. In other folders `bun` may be another version, and older versions fail with `undefined is not an object (evaluating 'Bun.YAML.parse')`. To run aid from your project folder, call Bun 1.4.4 or newer through mise:

```sh
alias aid='mise exec bun@1.4.4 -- bun /path/to/aid/src/cli/index.ts'
aid build
```

The rest of this site writes `aid <command>`. With a source checkout, read it as one of the forms above.

## Compile the binaries

```sh
bun run build
```

`bun run build` runs `scripts/compile.ts`, which:

1. deletes `dist/`;
2. writes the config JSON Schema to `schemas/aid.schema.json` and copies it to `dist/schemas/`;
3. bundles the browser scripts into the gitignored `.aid-build/_bundled.ts`, so each binary embeds them;
4. compiles one binary per target into `dist/bin/`.

| Target | Output |
| --- | --- |
| macOS, Apple silicon | `dist/bin/aid-darwin-arm64` |
| macOS, Intel | `dist/bin/aid-darwin-x64` |
| Linux, arm64 | `dist/bin/aid-linux-arm64` |
| Linux, x64 | `dist/bin/aid-linux-x64` |

There is no Windows target. The Linux binaries need glibc: on a musl system such as Alpine, a binary stops with `aid: unsupported platform` when it first compiles CSS. Each binary is between 199 and 222 MB, because it embeds Bun, the Tailwind compiler, `buf`, and the browser scripts.

> [!WARNING]
> A `darwin-x64` binary cross-compiled on Apple silicon carries an invalid ad-hoc signature, and macOS kills it on start. Re-sign a copy with `codesign --force --sign - <file>` to run it. The test suite runs the Linux binary outside the checkout, but nothing tests the macOS binaries on macOS yet. The [status page](../status.html) tracks it.
