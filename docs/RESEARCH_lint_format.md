# Research: replacing Biome in the aid binary

_Date: 2026-11-03. Measurements were taken on darwin-arm64 with Bun 1.4.4, Biome 2.6.4, oxfmt 0.76.0, and oxlint 1.91.0._

## Problem statement

`aid lint` and `aid fmt` use Biome, through `@biomejs/js-api` over `@biomejs/wasm-nodejs`, for JS, TS, JSON, and CSS. This brief asks whether oxlint and oxfmt, or Bun's built-in `bun lint` and `bun fmt`, would give a smaller binary and a better user experience.

## Constraints

- aid ships as one `bun build --compile` executable per target: darwin-arm64, darwin-x64, linux-arm64, and linux-x64.
- `src/lint/biome.ts` and `src/fmt/biome.ts` call Biome in-process with explicit file lists, because aid discovers files itself.
- A user config (`biome.json`) replaces the bundled default in `src/lint/configs/biome.default.ts`. The default is a 100-column line, double quotes, semicolons only where needed, and trailing commas everywhere.
- aid already embeds native files and extracts them at runtime: buf as an executable and lightningcss as a `.node` addon, through `src/core/internal/extract-embedded.ts`.

## Key finding: the binary does not contain Biome today

`@biomejs/wasm-nodejs` loads its module with `readFileSync(`${__dirname}/biome_wasm_bg.wasm`)`. `bun build --compile` does not embed files that the code reads by a runtime path. The compiled binary therefore reads the WASM from the build machine's `node_modules`, and `aid lint` fails with `ENOENT` on every other machine. `site/docs/status.html` and `site/docs/getting-started/installation.md` already document this bug.

I compiled `src/cli/index.ts` for darwin-arm64 twice, once as is and once with `@biomejs/js-api` replaced by an empty stub:

| Build | Size |
| --- | --- |
| Current, Biome JS glue only | 188.6 MB |
| Biome removed | 188.5 MB |
| Bun runtime alone, `console.log` entry | 85 MB |

Biome adds 0.1 MB today only because it is broken in the binary. A working embed adds `biome_wasm_bg.wasm`, which is 61.6 MB, so a fixed Biome build is about 250 MB. The size comparison below is against that fixed build, because the current 188.6 MB build does not work.

## Options

### Option 1: keep Biome and embed the WASM

- **What it is.** Import `biome_wasm_bg.wasm` with `with { type: "file" }` and instantiate it from the embedded bytes instead of through `@biomejs/wasm-nodejs`'s `__dirname` loader.
- **Strengths.** One tool and one config file (`biome.json`) for lint and format. It lints CSS and JSON as well as JS and TS. The WASM build has one artifact for every target, so it needs no per-platform staging.
- **Weaknesses.** It adds 61.6 MB to every binary, the largest single item after the Bun runtime. WASM is slower than native code. On aid's own 108 `src` and `packages/proto-ui/src` files, `aid fmt --check --filter biome` took 0.32 s and `aid lint --filter biome` took 0.66 s, run from source. Users don't notice this at docs-site scale.
- **Integration fit.** No API change. It needs a custom loader, because `@biomejs/wasm-nodejs` hard-codes the `__dirname` read.
- **Gotchas.** Each Biome bump must keep the custom loader in step with the wasm-bindgen glue in `biome_wasm.js`.

### Option 2: oxfmt and oxlint

- **What it is.** oxfmt (beta, 0.x) exports `format(fileName, sourceText, options): Promise<FormatResult>`. oxlint (1.x) exports only `defineConfig` and has no programmatic lint API, so aid would drive its CLI path and parse `--format json` output.
- **Size.** Each tool ships a napi-rs `.node` addon per platform. On darwin-arm64, `@oxfmt/binding-darwin-arm64` is 6.9 MB and `@oxlint/binding-darwin-arm64` is 12 MB. The JS packages are 8.6 MB (oxfmt, mostly bundled Prettier plugins) and 2.4 MB (oxlint). A compiled test entry that calls `format` was 95 MB against the 85 MB baseline. I estimate 25 to 30 MB for both tools, which saves 20 to 25 MB against Option 1.
- **Strengths.** Native speed. oxlint reads ESLint-style configs. oxfmt formats CSS, JSON, YAML, and markdown through bundled Prettier code, and it includes a Biome config migration (`migrate-biome`).
- **Weaknesses.** oxlint does not lint CSS or JSON, so aid loses CSS lint. Two more native binary families join buf and lightningcss in `scripts/natives.ts`, `stage-natives.ts`, and `deps:binaries`, with eight new platform subpackages pinned exactly. Without a lint API, oxlint integration depends on CLI internals.
- **Integration fit, tested.** The compile failed until I stubbed nine optional plugin imports (`@astrojs/compiler-rs`, `@prettier/plugin-hermes`, `@prettier/plugin-oxc`, `@prettier/plugin-pug`, `@shopify/prettier-plugin-liquid`, `@zackad/prettier-plugin-twig`, `prettier-plugin-marko`, `svelte`, `vite-plus`). It then compiled, but at runtime it threw `Cannot find native binding`. The napi-rs loader cannot `dlopen` from bunfs, so aid would need the lightningcss extract-and-`createRequire` pattern for both addons. oxfmt also runs work on `tinypool` worker threads, and I have not checked that inside a compiled binary.
- **Gotchas.** oxfmt is beta and its docs page still says alpha. oxfmt's own optional imports change between releases, so the stub list needs maintenance.

### Option 3: Bun's built-in `bun fmt` and `bun lint`

- **What it is.** The Bun runtime inside every aid binary ships both tools natively. A compiled executable runs as the `bun` CLI when it starts with `BUN_BE_BUN=1`. aid would spawn itself, for example `[process.execPath, "fmt", "--no-script", ...paths]` with `BUN_BE_BUN=1`. This also works from source, where `process.execPath` is `bun`.
- **Size.** 0 MB added, which saves 61.6 MB against Option 1 and 0.1 MB against today.
- **`bun fmt`, tested.** It is in Bun 1.4.4, aid's current pin. I compiled a one-line entry with `bun build --compile` and ran `BUN_BE_BUN=1 ./app fmt --no-script .` in an empty temp directory. It formatted TS, CSS, JSON, and markdown with no `node_modules` present. `--stdin-filepath` and `--check` also work. With `--print-width=100 --no-semi`, `bun fmt` left 105 of aid's 108 Biome-formatted source files unchanged. The other 3 files differed by 6 added lines and 19 removed lines. Two of the differences are `import ... with { type: "file" }` lines, which `bun fmt` keeps on one line past 100 columns. It took 0.04 s on those 108 files. It formats YAML, HTML, and many more languages. It reads Prettier configs, `.editorconfig`, oxfmt configs, and a `[fmt]` section in `bunfig.toml`, but not `biome.json`. Bun's release post reports 99.1% agreement with Prettier 3.9.9's own tests.
- **`bun lint`, not available yet.** Bun merged it on 2026-10-12, and it is in canary builds only. Bun 1.4.4 has no `lint` subcommand, which I checked locally. Its docs list 1,000+ rules, `--fix`, a `json` reporter, and type-aware rules through `bun check`. It reads ESLint configs, `.oxlintrc.json`, and a `[lint]` section in `bunfig.toml`. It lints `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`, `.mts`, and `.cts` files. It has no CSS lint, and its JSON and markdown rules need an ESLint config.
- **Weaknesses.** Neither tool has a JS API, so aid spawns a subprocess and parses its output: file names for `fmt --check`, and `--format json` for lint. Formatting and lint behavior change with each Bun bump, the same way they change with each Biome bump today. aid loses CSS lint.
- **Gotchas.**
  - Without `--no-script`, `bun fmt` runs the user's `package.json` `fmt` script instead of formatting. I hit this in the aid repo itself.
  - `bun fmt` reads the user's `.editorconfig` and `bunfig.toml`. aid must pass its default flags only when the user has no formatter config, and must not let CLI flags override a config the user wrote.
  - Users' existing `biome.json` files stop working. aid is at 0.0.0 and its binaries do not run standalone yet, so few users would be affected.

## Comparison

| Criterion | Option 1: Biome with embedded WASM | Option 2: oxfmt and oxlint | Option 3: `bun fmt` and `bun lint` |
| --- | --- | --- | --- |
| Binary size change vs a working Biome build | 0 MB (about 250 MB total) | -20 to -25 MB, estimated | -61.6 MB (about 188 MB total) |
| Works in the compiled binary today | No, needs a custom WASM loader | No, needs two native loaders and nine stubs | `fmt` yes (tested); `lint` waits for a Bun release |
| Languages formatted | JS, TS, JSON, CSS | JS, TS, JSON, CSS, YAML, markdown, more | JS, TS, JSON, CSS, YAML, markdown, HTML, more |
| Languages linted | JS, TS, JSON, CSS | JS, TS | JS, TS |
| In-process API | Yes | `format` only | None, subprocess |
| Native binary families to maintain | 0 | 2 new (8 subpackages) | 0 |
| Config file users write | `biome.json` | `.oxfmtrc.json`, `.oxlintrc.json` | Prettier config or `bunfig.toml`, ESLint or oxlint config |
| Format time on 108 files | 0.32 s | Not measured | 0.04 s |
| Maturity | Stable 2.x | oxlint 1.x stable, oxfmt 0.x beta | `fmt` new in 1.4.4, `lint` canary |
| License | MIT or Apache-2.0 | MIT | MIT |

Size is the largest difference. Option 3 adds nothing because the Bun runtime aid already ships contains the tools. Option 2 swaps a 61.6 MB WASM file for about 25 MB of native addons, and the addons are four times harder to embed than buf. Speed doesn't separate the options at the file counts docs sites have. On user experience, Options 2 and 3 format more languages and drop CSS lint. Option 3 lets users reuse the Prettier, ESLint, or oxlint config files they are most likely to have already.

## Recommendation

Use Option 3 and drop Biome from the binary.

1. Replace `src/fmt/biome.ts` with a `bun fmt` subprocess now. Bun 1.4.4 supports this, and the binary size stays at 188 MB instead of growing to about 250 MB.
2. Do not fix the Biome WASM embed in the meantime. That work would add 61.6 MB for code that this plan removes.
3. Replace `src/lint/biome.ts` with `bun lint --format json` once a stable Bun release ships it, and bump the mise pin in the same change. Until then, `aid lint` either skips JS, TS, and CSS or keeps the Biome path that already fails outside the build machine. I recommend skipping, because the current behavior is an `ENOENT` crash.

Option 2 only wins if aid must keep an in-process formatter API or must not depend on the Bun version for formatting behavior. Neither requirement exists today.

## Open questions

- Is losing CSS lint acceptable? Biome's recommended CSS rules catch unknown properties and duplicate declarations in custom theme CSS. Neither replacement has CSS lint. [RESEARCH_css_lint.md](./RESEARCH_css_lint.md) evaluates the replacements.
- How should aid map its bundled default to `bun fmt` flags? Bun's `[fmt]` section in `bunfig.toml` is per project, so aid would pass flags such as `--print-width=100 --no-semi` when it finds no user config.
- `bun fmt` formats YAML and keeps comments. `aid fmt` currently drops every comment from OpenAPI YAML files. Should `bun fmt` handle OpenAPI YAML too? This brief does not cover that.
- The aid repository uses Biome for its own lint, including the `plugins/no-promise-chains.grit` plugin. Switching the repo's dev tooling is a separate decision. It needs a replacement for the GritQL rule, for example an ESLint-style JS plugin, which `bun lint` supports.
- I could not test `bun lint` behavior inside a compiled binary, because it is not in a stable release yet.

## Sources

- [Bun v1.4.4 release notes (`bun fmt`)](https://bun.com/blog/bun-v1.4.4.md)
- [Bun lint docs](https://bun.sh/docs/lint)
- [oven-sh/bun#2246, maintainer comment on the `bun lint` and `bun fmt` merge](https://github.com/oven-sh/bun/issues/2246)
- [Oxfmt beta announcement](https://oxc.rs/blog/2026-02-24-oxfmt-beta)
- [Oxfmt usage docs](https://oxc.rs/docs/guide/usage/formatter.html)
- npm registry metadata from `npm view` for `oxfmt`, `oxlint`, `@oxfmt/binding-darwin-arm64`, `@oxlint/binding-darwin-arm64`, and `@biomejs/wasm-nodejs`, fetched 2026-11-03
- Local measurements: compiled builds of `src/cli/index.ts`, the `oxfmt` compile test, and `bun fmt` churn on aid's own sources
