---
title: Single binary
description: How scripts/compile.ts builds one aid executable per platform with the browser runtime, buf, and lightningcss embedded.
llms: optional
sidebar:
  order: 4
---

`bun run build` runs `scripts/compile.ts`, which produces `dist/bin/aid-<os>-<arch>` for four targets with `Bun.build` and its `compile` option. Each binary carries the browser runtime, the theme stylesheet, the buf binary, and the lightningcss native binding for its platform.

## compile.ts

`scripts/compile.ts` runs these steps in order and stops at the first failure:

1. `cleanDist` deletes `dist/` and creates `dist/bin/`.
2. `bun scripts/emit-schema.ts` rewrites `schemas/aid.schema.json` from the Zod schema.
3. `copySchema` copies the schema to `dist/schemas/aid.schema.json`.
4. `bun scripts/bundle-web.ts` bundles the browser runtime into `.aid-build/_bundled.ts`, which git ignores.
5. `checkStaged` from `scripts/check-binaries.ts` compares every `vendor/natives/<pkg>.bin` with its source in `node_modules`. A missing or stale copy stops the build and names the file, so no binary embeds an outdated lightningcss binding. Run `bun scripts/stage-natives.ts` to fix it.
6. `compileTarget` compiles `src/cli/index.ts` once per target, in this order. `scripts/natives.ts` holds this table as `TARGETS`, which `stage-natives.ts` and `check-binaries.ts` also read:

   | Output | Bun target | buf package | lightningcss package |
   | --- | --- | --- | --- |
   | `aid-darwin-arm64` | `bun-darwin-arm64` | `@bufbuild/buf-darwin-arm64` | `lightningcss-darwin-arm64` |
   | `aid-darwin-x64` | `bun-darwin-x64` | `@bufbuild/buf-darwin-x64` | `lightningcss-darwin-x64` |
   | `aid-linux-arm64` | `bun-linux-arm64` | `@bufbuild/buf-linux-aarch64` | `lightningcss-linux-arm64-gnu` |
   | `aid-linux-x64` | `bun-linux-x64` | `@bufbuild/buf-linux-x64` | `lightningcss-linux-x64-gnu` |

7. `printArtefacts` lists every file under `dist/` with its size.

There is no Windows target.

Each compile passes four kinds of options:

- `compile.executablePath` points at `node_modules/@oven/bun-<platform>/bin/bun`, the pinned Bun runtime for the target. That runtime is the one that ships `bun lint` and `bun fmt`, which `aid lint` and `aid fmt` run with `BUN_BE_BUN=1`.
- The `nativeStubs` plugin in `scripts/compile.ts` replaces the three other targets' buf binaries (`<pkg>/bin/buf`) and staged lightningcss bindings (`vendor/natives/<pkg>.bin`) with an empty string. Bun does not drop unused `with { type: "file" }` imports, so without it every binary would embed all four buf binaries (about 177 MB) and all four lightningcss bindings (about 36 MB). Do not use `external` for this: an external file import stays a runtime import, and the binary then fails at startup on any machine without aid's `node_modules`. `tests/unit/compile-natives.test.ts` checks that each target keeps exactly one of each, and `tests/integration/compiled-binary.test.ts` runs the binary from a directory with no `node_modules`.
- `define` sets `process.platform` to `"<os>"` and `process.arch` to `"<arch>"`. The platform checks in `src/lint/proto.ts` and `src/core/internal/lightningcss-native.ts` then pick the target's files at compile time, not the build machine's.
- `plugins` holds `jsonc-parser-esm`, which [the jsonc-parser section](#jsonc-parser) explains, and `aid-redirect-bundled`, which resolves every import of `src/web/_bundled.ts` to the generated `.aid-build/_bundled.ts`.

`compileTarget` is exported, so `tests/integration/compiled-binary.test.ts` can compile the host target alone.

Cross-compiling needs every platform package in `node_modules`. `mise install` provides them, as [development setup](./dev-setup.md) explains.

## The browser runtime

`src/core/web-entries.ts` lists the browser bundles:

- `WEB_JS` holds four entries: `aid-web` (`src/web/index.ts`), `aid-mermaid` (`src/web/mermaid-entry.ts`), `aid-openapi` (`src/web/openapi-entry.ts`), and `aid-proto` (`src/web/proto-entry.ts`).
- `WEB_CSS` holds two prebuilt stylesheets: `@scalar/api-reference/style.css` and `@aid/proto-ui/styles.css`.

`scripts/bundle-web.ts` bundles each `WEB_JS` entry with `bundleWebFiles`, the same code-split, minified browser ESM that a source build writes. The mermaid entry is about 7 KB, and each diagram type is a chunk that the browser loads only when a page uses it. It rebuilds `packages/proto-ui`, then reads each `WEB_CSS` file. It inlines every result in `.aid-build/_bundled.ts`: a JS entry becomes `{ entry, files }` (the entry file name and every output file by name), and a stylesheet becomes a string. It also inlines the theme component sources as `aidThemeSources`, because a compiled binary has no `src/theme/` for Tailwind to scan. `--out <file>` writes the module somewhere else, and `compileTarget(target, outfile, { bundled: <file> })` compiles against that file. The compiled-binary test uses this to keep its bundle in a temp dir. `compileTarget` throws when the bundled file does not exist.

aid's own copy of Tailwind's stylesheets (`tailwindcss/index.css`, `theme.css`, `preflight.css`, `utilities.css`) is embedded through `with { type: "file" }` imports in `src/core/tailwind.ts`, and `customCssResolver` maps every `tailwindcss` specifier to them, so `@import "tailwindcss"` resolves inside the binary.

At build time, `buildWebBundle` checks whether `src/web/index.ts` exists under aid's root. `compileTailwind` makes the same check: from source it scans `src/theme/` with `@source`, and in a binary it scans `aidThemeSources`. From a source checkout it does, and aid bundles from source with `Bun.build`. Inside a compiled binary it does not, and aid writes the embedded JS files under their hashed names and the embedded stylesheets with `writeHashed`. Both paths write the same file names. An empty embedded bundle throws an error that tells you to run `bun scripts/bundle-web.ts`.

> [!NOTE]
> `src/web/_bundled.ts` holds only empty placeholders, and no script writes to it. Source runs and tests import the placeholders and bundle from `src/web/`. When you add a `WEB_JS` entry, add an empty `{ entry: "", files: {} }` export here by hand. A `WEB_CSS` entry gets an empty string.

## Embedded buf

`src/lint/proto.ts` imports the buf binary of all four platforms with the file import attribute:

```ts
import bufDarwinArm64 from "@bufbuild/buf-darwin-arm64/bin/buf" with { type: "file" }
```

Each import gives a path string. From a source checkout, the path points into `node_modules`. Inside a compiled binary, it points into Bun's embedded file system under `/$bunfs/`, which a process can read but not execute. `resolveBufBinary` picks the path for `process.platform` and `process.arch`. For a `/$bunfs/` path, it calls `extractEmbedded` (`src/core/internal/extract-embedded.ts`), which copies the file to `<tmpdir>/aid-buf-XXXXXX/buf` with mode `0755`. When no embedded binary exists, it falls back to `buf` on `PATH`. The result is cached for the process. `aid lint` and `aid fmt` both use it.

## Embedded lightningcss

Tailwind's `@tailwindcss/node` loads lightningcss, which loads its native binding with `require("lightningcss-<platform>")`. A compiled Bun binary does not follow that dynamic require, and Bun loads any imported `.node` file through the Node-API loader even with `with { type: "file" }`. aid works around both:

1. `scripts/stage-natives.ts` copies each platform's `lightningcss.<platform>.node` to `vendor/natives/lightningcss-<platform>.bin`. `vendor/` is git-ignored, and the `mise install` hook runs the script.
2. `src/core/internal/lightningcss-native.ts` imports the four `.bin` files with `with { type: "file" }`. The `*.bin` module declaration is in `src/core/internal/lightningcss-bin.d.ts`.
3. `installLightningcssShim` picks the binding for the platform, extracts it to a temp file named `<package>.node`, and loads it with `createRequire`. It then patches `Module.prototype.require` so `require("lightningcss-<platform>")` returns the loaded binding.
4. `compileTailwind` awaits `installLightningcssShim` before it imports `@tailwindcss/node`. The shim installs once per process.

The shim runs from a source checkout too. If `vendor/natives/` is empty, the import of the `.bin` files fails, so run `mise install` before any build.

## jsonc-parser

Spectral parses JSON specs through `@stoplight/json`, which calls `require("jsonc-parser")`. The package's `main` entry is a UMD build that calls `require("./impl/format")` and its siblings through the UMD factory argument. Bun's bundler does not follow those calls, so a compiled binary fails with `Cannot find module './impl/format'` on the first JSON OpenAPI file.

The `jsonc-parser-esm` plugin in `scripts/compile.ts` resolves every `jsonc-parser` import to `lib/esm/main.js` of the copy that the importer resolves, so each consumer keeps the version it declares. The plugin runs only at compile time. A source checkout loads the UMD build through Bun's runtime `require`, which follows the calls.

`tests/integration/compiled-binary.test.ts` compiles the host binary, lints a malformed JSON spec from `tests/fixtures/lint-fixtures/openapi-bad-json/`, and checks that the output matches the source CLI.

## The theme stylesheet

`src/core/tailwind.ts` imports the bundled theme as a string:

```ts
import bundledMainCss from "../theme/main.css" with { type: "text" }
```

The compiled binary carries the CSS text. `compileTailwind` uses it when the project has no stylesheet of its own, and substitutes it for every `@import "aid/theme"`.
