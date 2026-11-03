---
title: Single binary
description: How scripts/compile.ts builds one aid executable per platform with the browser runtime, buf, and lightningcss embedded.
llms: optional
sidebar:
  order: 4
---

`bun run build` runs `scripts/compile.ts`, which produces `dist/bin/aid-<os>-<arch>` for four targets with `bun build --compile`. Each binary carries the browser runtime, the theme stylesheet, the buf binary, and the lightningcss native binding for its platform.

## compile.ts

`scripts/compile.ts` runs these steps in order and stops at the first failure:

1. `cleanDist` deletes `dist/` and creates `dist/bin/`.
2. `bun scripts/emit-schema.ts` rewrites `schemas/aid.schema.json` from the Zod schema.
3. `copySchema` copies the schema to `dist/schemas/aid.schema.json`.
4. `bun scripts/bundle-web.ts` bundles the browser runtime into `src/web/_bundled.ts`.
5. `compileTarget` runs `bun build --compile src/cli/index.ts` once per target, in this order:

   | Output | Bun target | buf package | lightningcss package |
   | --- | --- | --- | --- |
   | `aid-darwin-arm64` | `bun-darwin-arm64` | `@bufbuild/buf-darwin-arm64` | `lightningcss-darwin-arm64` |
   | `aid-darwin-x64` | `bun-darwin-x64` | `@bufbuild/buf-darwin-x64` | `lightningcss-darwin-x64` |
   | `aid-linux-arm64` | `bun-linux-arm64` | `@bufbuild/buf-linux-aarch64` | `lightningcss-linux-arm64-gnu` |
   | `aid-linux-x64` | `bun-linux-x64` | `@bufbuild/buf-linux-x64` | `lightningcss-linux-x64-gnu` |

6. `printArtefacts` lists every file under `dist/` with its size.

There is no Windows target.

Each compile passes two kinds of flags:

- `--external <pkg>/bin/buf` for the three other targets' buf packages, and `--external <pkg>/*` for the three other lightningcss packages. Bun does not drop unused `with { type: "file" }` imports, so without these flags every binary would embed all four buf binaries (about 200 MB) and all four lightningcss bindings (about 24 MB).
- `--define process.platform="<os>"` and `--define process.arch="<arch>"`. The platform checks in `src/lint/proto.ts` and `src/core/internal/lightningcss-native.ts` then pick the target's files at compile time, not the build machine's.

Cross-compiling needs every platform package in `node_modules`. `mise install` provides them, as [development setup](./dev-setup.md) explains.

## The browser runtime

`src/core/web-entries.ts` lists the browser bundles:

- `WEB_JS` holds four entries: `aid-web` (`src/web/index.ts`), `aid-mermaid` (`src/web/mermaid-entry.ts`), `aid-openapi` (`src/web/openapi-entry.ts`), and `aid-proto` (`src/web/proto-entry.ts`).
- `WEB_CSS` holds two prebuilt stylesheets: `@scalar/api-reference/style.css` and `@aid/proto-ui/styles.css`.

`scripts/bundle-web.ts` bundles each `WEB_JS` entry with `bundleWebEntry` (minified ESM for the browser, no code splitting). It rebuilds `packages/proto-ui`, then reads each `WEB_CSS` file. It writes every result to `dist/web/` and inlines every result as a JSON string export in `src/web/_bundled.ts`, for example `export const aidWebJs = "..."`.

At build time, `buildWebBundle` checks whether `src/web/index.ts` exists under aid's root. From a source checkout it does, and aid bundles from source with `Bun.build`. Inside a compiled binary it does not, and aid writes the embedded strings with `writeHashed`. An empty embedded string throws an error that tells you to run `bun scripts/bundle-web.ts`.

> [!WARNING]
> `src/web/_bundled.ts` is committed with empty-string placeholders. `bun run build` and `bun scripts/manual-test.ts` overwrite it with the full minified bundles. Do not commit that version. Restore it after a local build:
>
> ```sh
> git restore src/web/_bundled.ts
> ```

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

## The theme stylesheet

`src/core/tailwind.ts` imports the bundled theme as a string:

```ts
import bundledMainCss from "../theme/main.css" with { type: "text" }
```

The compiled binary carries the CSS text. `compileTailwind` uses it when the project has no stylesheet of its own, and substitutes it for every `@import "aid/theme"`.
