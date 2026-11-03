# Research: implementation language and stack for `aid`

Status: historical research brief. The project chose Bun and TypeScript; see `site/docs/contributing/build-pipeline.md` for the current design.

## Problem statement

`aid` is a single-binary static documentation site generator (see [PRODUCT_OVERVIEW.md](./PRODUCT_OVERVIEW.md)). When this brief was written, the implementation language had not been chosen. The language decides which libraries are available and how the binary is distributed.

This brief compares Go, Rust, Bun, and eight other languages, recommends a default, and lists when to pick each alternative.

## Constraints

Every candidate must meet these requirements:

1. **Single statically-linked binary, no external dependencies.** Users install one file.
2. **Cross-compile to six targets.** macOS, Linux, and Windows on x64 and arm64, ideally from one CI host.
3. **Rendering.** GFM Markdown with frontmatter and Mermaid source passthrough, HTML, OpenAPI v2 and v3, and `.proto` files.
4. **Parse `.proto` source into a structured AST** for documentation rendering (not message marshalling).
5. **Emit a MiniSearch-format inverted search index in pure native code.** No embedded JS runtime at build time.
6. **Embed and extract foreign binaries at runtime** (Tailwind 4 standalone, Biome, format linters).
7. **Dev server** with file watching and live reload (WebSocket or SSE).

Soft preferences:

- Reasonable binary size (under 50 MB before embedded payloads).
- An existing single-binary tool of similar scope written in the language.
- A language that is easy to hire for and that outside contributors know.

## Options

### Option 1: Go

Verdict: strong fit, lowest-risk default.

A maintained pure-Go library exists for every hard constraint. Caddy, Buf, and Hugo ship bundled tools with `embed` and `os/exec`. Setting `GOOS` and `GOARCH` cross-compiles to any target.

Library shortlist (all pure Go, no CGO):

| Capability | Library | Maintenance | Notes |
| --- | --- | --- | --- |
| GFM markdown | `yuin/goldmark` | v1.8.2 Mar 2026, 4.8k stars | Powers Hugo; CommonMark-strict |
| Frontmatter | `abhinav/goldmark-frontmatter` | Active | YAML/TOML/JSON |
| HTML templates | `a-h/templ` (or stdlib `html/template`) | Active | `templ` adds a codegen step but is type-safe and faster |
| OpenAPI v2 + v3 | `pb33f/libopenapi` (or `getkin/kin-openapi`) | Active | `libopenapi` covers 3.0/3.1/3.2 + Swagger 2 |
| `.proto` parsing | `bufbuild/protocompile` | Active (Buf-backed) | Full AST + comments via `sourceinfo` |
| File watcher | `fsnotify/fsnotify` | De-facto standard | No recursive API, wrap it by hand |
| HTTP + WS | `net/http` + `coder/websocket` | Active | SSE off `net/http` directly, no library |
| Asset embedding | stdlib `embed` | Stdlib | Handles multi-MB binaries fine |
| YAML | `goccy/go-yaml` | Active | `yaml.v3` is archived |

**MiniSearch JSON emission is feasible from Go.** The `AsPlainObject` shape is a flat structure (`documentCount`, `nextId`, `documentIds`, `fieldIds`, `fieldLength`, `averageFieldLength`, `storedFields`, `index`, `serializationVersion`), so `encoding/json` can write it. The MiniSearch maintainer flattened the format in v4 to "facilitate tools that create a serialized MiniSearch index in other languages."

**Strengths.** Go has the simplest distribution of any candidate, the least dependency churn, the fastest path to an MVP, and the largest hiring pool.

**Weaknesses.** Error handling is verbose, Go has no sum types, and the choice between `templ` and `html/template` is hard to reverse.

Hugo, Caddy, Buf, and MinIO are production single-binary Go tools that embed assets and run bundled tools.

**Gotchas.** Keep `CGO_ENABLED=0` so cross-compiling keeps working. Embedding all six platform builds of Tailwind and Biome grows the binary to 200-400 MB, unless each release artifact targets one platform through build tags.

### Option 2: Rust

Verdict: strong fit, slightly more friction than Go for this product.

Rust meets every hard constraint, and its libraries are mature. Zola is a Rust tool with the same architecture. Tailwind maintainers declined to publish Oxide as a Rust crate ([discussion #16191](https://github.com/tailwindlabs/tailwindcss/discussions/16191)), so a Rust build would run the Tailwind standalone binary.

Library shortlist:

| Capability | Crate | Notes |
| --- | --- | --- |
| GFM markdown + frontmatter | `comrak` | cmark-gfm port; powers crates.io, docs.rs, GitLab |
| OpenAPI v3.0 + v2 | `openapiv3-extended` | Original `openapiv3` is v3.0-only |
| OpenAPI v3.1 | `oas3` | Use both crates with a version discriminator |
| `.proto` parsing | `protox-parse` | Returns canonical `FileDescriptorProto` |
| YAML | `serde_yaml_ng` | `serde_yaml` is unmaintained |
| Templates | `minijinja` | Runtime-loadable (matters for user theming); Askama is compile-time only |
| HTTP + WS | `axum` + `tokio-tungstenite` | Most-used pairing |
| File watcher | `notify` + `notify-debouncer-full` | Most-used watcher |
| Asset embedding | `rust-embed` | Compile-time embed with FS fallthrough in dev |

**Strengths.** Rust produces the smallest binaries (8-20 MB before payloads) and has the strongest type system. `rayon` parallelizes builds. uv, ruff, and Zola ship the same way.

**Weaknesses.** Clean release builds take 1.5 to 4 minutes. OpenAPI support is split across two crates. Borrow-checker friction in glue code (template lifetimes, `RefCell` in AST traversal) slows a small team, and this tool is not memory- or performance-critical.

**Gotchas.** `serde_yaml` is unmaintained. A fully static Linux binary needs the `*-unknown-linux-musl` target. Cross-compiling for macOS from Linux CI needs the macOS SDK injected.

### Option 3: Bun `--compile` (TypeScript)

Verdict: medium-to-strong fit, the option least like the other two.

The whole tool is TypeScript. `bun build --compile --target=bun-darwin-arm64 …` packs the Bun runtime, the code, and the assets into one executable. Users still download one file.

How this option differs:

- **MiniSearch runs in-process.** The build imports MiniSearch, builds the index, and writes `JSON.stringify(ms.toJSON())`. aid does not reimplement the format, so it cannot drift from `serializationVersion`.
- **Tailwind 4 is an npm dependency.** `@tailwindcss/node` is a programmatic API over `@tailwindcss/oxide`, so aid does not extract a binary to a temp directory.
- **Biome is an npm dependency.** `@biomejs/js-api` wraps `@biomejs/wasm-nodejs`, and the WASM build runs on every target without a per-architecture package.
- **One language end-to-end.** The build pipeline, the browser code, and the search index share one TypeScript codebase.

Library shortlist (all npm, all pure JS unless flagged):

| Capability | Package | Notes |
| --- | --- | --- |
| Markdown | `unified` + `remark-parse` + `remark-gfm` + `remark-frontmatter` | Most-used pipeline |
| OpenAPI v2/v3/3.1 | `@scalar/openapi-parser` | Modern; upgrades 2.0 specs to 3.1 |
| `.proto` parsing | `protobufjs` | Runtime parser; `@bufbuild/protobuf` requires codegen |
| YAML | `yaml` (eemeli) | Faster than `js-yaml` |
| File watch | `chokidar` v5 | Widely used |
| HTTP + WS + SSE | `Bun.serve` (built-in) | No npm dependency |
| Search | `minisearch` v7 | Main advantage of this option |
| Tailwind | `@tailwindcss/node` (wraps native `@tailwindcss/oxide`) | Native addon, see the risk below |
| Biome | `@biomejs/js-api` (WASM) | Pure WASM, no per-architecture package |

Bun fits this product better than Deno. Bun can target `bun-windows-arm64`, and Deno's `--target` cannot. Bun had higher npm compatibility (about 98% against Deno's 95%; this brief did not record the source). Bun also has built-in TypeScript, JSX, SQLite, and embedded-file APIs.

**Strengths.** Bun has the fastest TypeScript edit-and-run loop. The search code calls MiniSearch directly. The tool can use any npm package.

**Weaknesses.**

- The binary is at least 55-100 MB because the runtime ships inside it. That is similar to installing MkDocs or Docusaurus, and large next to a 12 MB Go binary.
- `@tailwindcss/oxide` is a per-platform N-API native addon. Embedding `.node` files in `bun build --compile` output works, but it has a history of bugs on Windows, WSL, and ARM. CI has to test each release on every target architecture.
- `bun build --compile` is younger than `deno compile` and has open issues with dynamic `require`, worker threads, and Windows code signing.

**Gotchas.** Each target needs a static `require("./node_modules/@tailwindcss/oxide-darwin-arm64/index.node")` of its own oxide `.node` file so the compiler embeds the right one. If the native addon causes too many failures, embed the Tailwind standalone binary instead, as Go and Rust would.

### Option 4: other languages (Zig, .NET AOT, Swift, OCaml, Nim, Crystal, Haskell, C++)

Verdict: rule out for this product.

Two constraints decide this group. One CI host must cross-compile every target, and one ecosystem must have mature parsers for both `.proto` source and OpenAPI v2 and v3. Go and Rust meet both, and Bun meets both through npm. Per language:

- **Zig.** Zig has the best cross-compilation of any language, `@embedFile`, and a good `.proto` parser (`mattnite/protobuf`). It has no mature OpenAPI parser, and 0.16 brings more breaking changes before 1.0. Reconsider if 1.0 ships and an OpenAPI parser appears.
- **.NET 9 and 10 Native AOT.** .NET has the best libraries of this group (Markdig, Microsoft.OpenApi.NET, protobuf-net `FileDescriptor` parsing). Native AOT cannot cross-compile between operating systems, so each target OS needs its own build host. Rule it out unless Microsoft adds cross-OS AOT.
- **Swift.** Apple maintains the libraries, and the static Linux SDK works. Swift cannot cleanly cross-compile a static Windows binary, and its `.proto` source parser is weak. Rule it out.
- **OCaml.** OCaml has no OpenAPI parser, weak Windows cross-compilation, and a small hiring pool. Rule it out.
- **Nim.** `protobuf-nim` is "early phase, proto3 only", and Nim has no OpenAPI parser. Rule it out.
- **Crystal.** Windows cross-compilation is incomplete, and Crystal has no OpenAPI parser. Rule it out.
- **Haskell.** Haskell has `cmark-gfm` (C bindings), `openapi3` (3.0 only), and `proto-lens`. Cross-OS compilation is painful, GHC on Alpine is fragile, and the hiring pool is small. Rule it out.
- **C++.** A new C++ codebase in 2026 costs more effort than Go or Rust and gains nothing here. Rule it out.
- **Roc, Gleam, and V.** Roc is pre-1.0, Gleam has no native binary output, and V had credibility issues. Rule them out.

## Comparison

| Criterion | Go | Rust | Bun |
| --- | --- | --- | --- |
| Single-binary, 6-target cross-compile | Best: built in through `GOOS` and `GOARCH` | Strong via `cargo` + `cross` | Strong; Windows ARM64 supported in Bun, not Deno |
| Pre-payload binary size | ~10-15 MB | ~8-20 MB | ~55-100 MB (runtime ships inside) |
| Foreign-binary embed-and-exec | `embed` + `os/exec`; widely used | `include_bytes!` + `std::process` (uv, ruff precedent) | `with { type: "file" }` + `Bun.spawn`; younger |
| GFM Markdown | `goldmark` (mature) | `comrak` (mature) | `unified`/`remark-gfm` (mature) |
| OpenAPI v2 + v3 + 3.1 | `libopenapi` covers all in one | Two crates required (`openapiv3-extended` + `oas3`) | `@scalar/openapi-parser` (one) |
| `.proto` source parser | `bufbuild/protocompile` (Buf-backed) | `protox-parse` | `protobufjs` |
| MiniSearch index emission | Manual JSON shape (~300 LOC) | Manual JSON shape (~300 LOC) | Uses MiniSearch directly |
| Tailwind 4 integration | Embed-and-exec the standalone CLI | Embed-and-exec (no Oxide crate) | `@tailwindcss/node` as a JS dep |
| Biome integration | Embed-and-exec | Embed-and-exec | `@biomejs/js-api` WASM, pure-portable |
| HTTP + WS + SSE | stdlib + `coder/websocket` | `axum` + `tokio-tungstenite` | `Bun.serve` (built-in) |
| File watching | `fsnotify` | `notify` | `chokidar` v5 |
| Compile-time / dev loop | Fast | Slow (1.5-4 min clean release) | Fastest (TypeScript on Bun) |
| Solo/small-team velocity | High | Medium (borrow-checker tax in glue code) | High |
| Hiring pool | Largest | Medium | Large (TS) but Bun-specific is small |
| Risk of language/runtime churn | Low | Low | Medium (Bun's `--compile` still maturing) |
| Real-world precedent | Hugo, Caddy, Buf | Zola, uv, ruff | Few production CLIs at this scope yet |

### Where the options diverge most

- **MiniSearch.** Only Bun builds the index with MiniSearch itself instead of reimplementing its JSON format. A format change reaches Bun through a package update. A Go or Rust emitter would need a code change.
- **Tailwind and Biome.** Bun loads both as npm dependencies (Biome as WASM), so neither needs an embed-and-exec step. Go and Rust run both as child processes.
- **Binary size.** Go and Rust binaries are 10-20 MB, and Bun binaries are 55-100 MB. The larger download does not change behavior, but users will notice it.
- **Maturity.** Every Go library on the list is more than five years old. Rust matches that except for a second OpenAPI crate. Bun's `--compile` and native-addon embedding are the newest of the three.

## Recommendation

Superseded: the project chose Bun (Option 3). The recommendation below is the one this brief made at the time.

**Default to Go.** It is the lowest-risk option that meets every constraint. Every dimension has a mature library (`goldmark`, `libopenapi`, `bufbuild/protocompile`, `fsnotify`, `coder/websocket`, `embed`, `goccy/go-yaml`). Go has the best six-target cross-compilation of any candidate, ahead of Rust once cross-OS friction counts. Hugo, Caddy, and Buf already embed and run bundled tools this way at scale. A small team will move fastest in Go.

**Pick Rust instead if:**

- Build speed on large sites turns out to matter against Hugo, MkDocs, and Docusaurus. Measure it first.
- The team has more Rust expertise than Go expertise.
- A binary half the size before payloads matters. It usually does not, because the payloads make up most of the size.

**Pick Bun instead if:**

- We want TypeScript for the build pipeline, the browser runtime, and search, and one language is worth the larger binary and the native-addon risk.
- The team knows TypeScript better than Go or Rust.
- We will run CI on every target architecture from the start, to catch `@tailwindcss/oxide` breakage on all six targets.

Do not pick any language from Option 4. Revisit Zig if 1.0 ships and an OpenAPI parser appears. Revisit .NET if Microsoft adds cross-OS Native AOT.

## Open questions

1. Resolved: the browser search uses MiniSearch (`minisearch` in package.json).
2. Resolved: releases ship one binary per platform (`scripts/compile.ts`).
3. Resolved: templates are TSX components rendered by aid's own JSX runtime (`src/jsx-runtime.ts`).
4. Resolved: Mermaid renders in the browser (`src/web/mermaid-entry.ts`).
