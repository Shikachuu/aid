# Research: Implementation Language / Stack for `aid`

## Problem Statement

`aid` is a single-binary static documentation site generator (see [PRODUCT_OVERVIEW.md](./PRODUCT_OVERVIEW.md)). The implementation language has not been chosen. The decision is foundational — it gates library availability, distribution mechanics, and team velocity for years.

This brief evaluates a wide candidate set and recommends a default with explicit "switch to X if…" conditions.

## Constraints

Hard requirements that gate every candidate:

1. **Single statically-linked binary, zero external deps.** Users install one file.
2. **Cross-compile to {macOS, Linux, Windows} × {x64, arm64}** — six targets — ideally from a single CI host.
3. **Render**: GFM Markdown (+ frontmatter, + Mermaid source passthrough), HTML, OpenAPI v2 + v3, `.proto` files.
4. **Parse `.proto` source into a structured AST** for documentation rendering (not message marshalling).
5. **Emit a MiniSearch-format inverted search index in pure native code** — no embedded JS runtime at build time.
6. **Embed and extract foreign binaries at runtime** (Tailwind 4 standalone, Biome, format linters).
7. **Dev server** with file watching + live reload (websocket or SSE).

Soft preferences:
- Reasonable binary size (target < 50 MB before embedded payloads).
- Mature, single-binary precedent in the wild (a tool like ours that already exists in the language).
- Hireable / community-contributable language.

## Options

### Option 1 — Go

**Verdict: STRONG FIT, lowest-risk default.**

Every hard constraint maps onto a mature, actively maintained pure-Go library. The `embed` + `os/exec` pattern for shipping bundled tools is well-trodden by Caddy, Buf, Hugo, and dozens of Go CLIs of comparable scope. Cross-compilation via `GOOS`/`GOARCH` is the language's flagship feature.

**Library shortlist** (all pure Go, no CGO):

| Capability | Library | Maintenance | Notes |
|---|---|---|---|
| GFM markdown | `yuin/goldmark` | v1.8.2 Mar 2026, 4.8k★ | Powers Hugo; CommonMark-strict |
| Frontmatter | `abhinav/goldmark-frontmatter` | Active | YAML/TOML/JSON |
| HTML templates | `a-h/templ` (or stdlib `html/template`) | Active | `templ` adds codegen step but is type-safe + faster |
| OpenAPI v2 + v3 | `pb33f/libopenapi` (or `getkin/kin-openapi`) | Active | `libopenapi` covers 3.0/3.1/3.2 + Swagger 2 |
| `.proto` parsing | `bufbuild/protocompile` | Active (Buf-backed) | Full AST + comments via `sourceinfo` |
| File watcher | `fsnotify/fsnotify` | De-facto standard | No recursive API — wrap manually |
| HTTP + WS | `net/http` + `coder/websocket` | Active | SSE off `net/http` directly, no library |
| Asset embedding | stdlib `embed` | Stdlib | Handles multi-MB binaries fine |
| YAML | `goccy/go-yaml` | Active | `yaml.v3` is archived |

**MiniSearch JSON emission is feasible from Go.** The `AsPlainObject` shape is a flat structure (`documentCount`, `nextId`, `documentIds`, `fieldIds`, `fieldLength`, `averageFieldLength`, `storedFields`, `index`, `serializationVersion`) — straightforward `encoding/json` work. The MiniSearch maintainer specifically flattened the format in v4 to "facilitate tools that create a serialized MiniSearch index in other languages."

**Strengths**: simplest distribution story of any candidate; smallest dependency churn; fastest path to MVP; largest hireable pool.

**Weaknesses**: verbose error handling; no sum types; templating choice is a fork in the road (`templ` vs `html/template`).

**Real-world precedent**: Hugo, Caddy, Buf, MinIO — all production single-binary Go tools embedding assets and shelling to bundled tools.

**Gotchas**: keep `CGO_ENABLED=0` to preserve cross-compile; embedding all 6 platform variants of Tailwind+Biome bloats to 200–400 MB unless you build per-platform release artifacts with build tags.

### Option 2 — Rust

**Verdict: STRONG FIT, slightly more friction than Go for this product.**

All hard constraints satisfied. Library coverage is mature; the precedent project is **Zola** — essentially the architecture we're describing, in Rust. The "Tailwind Oxide as a Rust crate" angle, which would have been a Rust-only superpower, is officially **not happening** — Tailwind maintainers declined a Rust crate in [discussion #16191](https://github.com/tailwindlabs/tailwindcss/discussions/16191). So we shell out to the Tailwind binary like everyone else.

**Library shortlist:**

| Capability | Crate | Notes |
|---|---|---|
| GFM markdown + frontmatter | `comrak` | cmark-gfm port; powers crates.io, docs.rs, GitLab |
| OpenAPI v3.0 + v2 | `openapiv3-extended` | Original `openapiv3` is v3.0-only |
| OpenAPI v3.1 | `oas3` | Use both crates with a version discriminator |
| `.proto` parsing | `protox-parse` | Returns canonical `FileDescriptorProto` |
| YAML | `serde_yaml_ng` | `serde_yaml` is unmaintained |
| Templates | `minijinja` | Runtime-loadable (matters for user theming); Askama is compile-time only |
| HTTP + WS | `axum` + `tokio-tungstenite` | Settled choice |
| File watcher | `notify` + `notify-debouncer-full` | Standard |
| Asset embedding | `rust-embed` | Compile-time embed with FS fallthrough in dev |

**Strengths**: smallest binaries (8–20 MB before payloads); strongest type system; `rayon` parallelism for builds is best-in-class; precedent (uv, ruff, Zola) for exactly this distribution pattern.

**Weaknesses**: 1.5–4 minute clean release builds; OpenAPI is fragmented across two crates; borrow-checker friction in glue code (template lifetimes, `RefCell` in AST traversal) costs measurable solo/small-team velocity for a tool that isn't memory- or perf-critical.

**Gotchas**: `serde_yaml` situation; `*-unknown-linux-musl` for genuine static Linux; macOS cross-compile from Linux CI needs SDK injection.

### Option 3 — Bun `--compile` (TypeScript)

**Verdict: MIDDLING-TO-STRONG, the radically different bet.**

Write the whole tool in TypeScript; `bun build --compile --target=bun-darwin-arm64 …` bakes the runtime + your TS + assets into a single executable. The runtime is *inside* the binary — still one file, no external deps for the user.

**Why this is genuinely different:**

- **MiniSearch becomes trivial.** It IS a JS library. `import MiniSearch`, build the real index in-process, `JSON.stringify(ms.toJSON())`. No format reverse-engineering, no `serializationVersion` drift risk.
- **Tailwind 4 stops being "embed and exec a binary."** `@tailwindcss/node` is a programmatic API wrapping `@tailwindcss/oxide` — used as a regular npm dep. No extract-to-tempdir ceremony.
- **Biome stops being "embed and exec a binary."** `@biomejs/js-api` wraps `@biomejs/wasm-nodejs`. WASM is portable across all targets — zero per-arch headaches.
- **One language end-to-end.** Build pipeline, browser-side glue, and search index all share the same TypeScript codebase.

**Library shortlist (all npm, all pure JS unless flagged):**

| Capability | Package | Notes |
|---|---|---|
| Markdown | `unified` + `remark-parse` + `remark-gfm` + `remark-frontmatter` | Standard pipeline |
| OpenAPI v2/v3/3.1 | `@scalar/openapi-parser` | Modern; auto-upgrades 2.0 → 3.1 |
| `.proto` parsing | `protobufjs` | Runtime parser; `@bufbuild/protobuf` requires codegen |
| YAML | `yaml` (eemeli) | Faster than `js-yaml` |
| File watch | `chokidar` v5 | Battle-tested |
| HTTP + WS + SSE | `Bun.serve` (built-in) | Zero npm dep |
| Search | `minisearch` v7 | **The killer feature** of this option |
| Tailwind | `@tailwindcss/node` (wraps native `@tailwindcss/oxide`) | Native addon — see risk below |
| Biome | `@biomejs/js-api` (WASM) | Pure WASM — no per-arch worry |

**Bun > Deno for this product**: better cross-compile target matrix (Bun ships `bun-windows-arm64`; Deno's `--target` omits it), better `Bun.serve`, better npm compat (~98% vs ~95%), built-in TS/JSX/SQLite/embedded-files API.

**Strengths**: fastest TypeScript DX; smallest gap between "what it does" and "what you write" (the search index code in particular); reuses the largest library ecosystem on earth.

**Weaknesses**:
- Binary size ~55–100 MB minimum (the runtime ships inside). Defensible against MkDocs/Docusaurus, looks heavy next to a 12 MB Go binary.
- `@tailwindcss/oxide` is a per-platform N-API native addon. Embedding native `.node` files in a `bun build --compile` output works but isn't yet boring — historical bug tail around Windows/WSL/ARM. Each release must be tested on every target arch.
- `bun build --compile` is younger than `deno compile`; edge cases around dynamic `require`, worker threads, and Windows code-signing remain rough.

**Gotchas**: explicitly static `require("./node_modules/@tailwindcss/oxide-darwin-arm64/index.node")` per target to ensure the right `.node` is embedded; if the oxide native-addon path is too painful, fall back to embedding the Tailwind standalone binary the same way Go/Rust would.

### Option 4 — Outsiders (Zig, .NET AOT, Swift, OCaml, Nim, Crystal, Haskell, C++)

**Verdict: RULE OUT for this product.**

The decisive constraints are **(a) one-host cross-compiles-everything** and **(b) a mature `.proto` source parser AND OpenAPI v2/v3 parser in the same ecosystem**. Only Go and Rust clear both bars cleanly; Bun clears them via npm. Detailed triage:

- **Zig** — Best cross-compile of any language; killer `@embedFile`; great `.proto` parser (`mattnite/protobuf`). **No mature OpenAPI parser.** Pre-1.0 churn (0.16 brings another breaking wave). MIDDLING if 1.0 ships and someone publishes an OpenAPI parser; otherwise rule out.
- **.NET 9/10 Native AOT** — Best library ecosystem of the outsiders (Markdig, Microsoft.OpenApi.NET, protobuf-net `FileDescriptor` parsing). **Native AOT does not support cross-OS compilation** — must build on each target OS. Rule out unless Microsoft adds cross-OS AOT.
- **Swift** — Apple-blessed libraries; static Linux SDK works. **No clean Windows static binary cross-compile**; weak `.proto` source parser. Rule out.
- **OCaml** — Beautiful language, no OpenAPI parser, weak Windows cross-compile, tiny hiring pool. Rule out.
- **Nim** — `protobuf-nim` is "early phase, proto3 only"; no OpenAPI parser. Rule out.
- **Crystal** — Windows cross-compile is incomplete; no OpenAPI parser. Rule out.
- **Haskell** — `cmark-gfm` (C bindings), `openapi3` (3.0 only), `proto-lens`. Cross-OS cross-compile painful, hiring pool tiny, GHC-on-Alpine fragility. Rule out.
- **C++** — Greenfield 2026; opportunity cost dominates. Rule out.
- **Roc / Gleam / V** — pre-1.0, no native binary story (Gleam), or credibility issues (V). Rule out.

## Comparison

| Criterion | Go | Rust | Bun |
|---|---|---|---|
| Single-binary, 6-target cross-compile | **Best in class** — flagship feature | Strong via `cargo` + `cross` | Strong; Windows ARM64 supported in Bun, not Deno |
| Pre-payload binary size | ~10–15 MB | ~8–20 MB | **~55–100 MB** (runtime ships inside) |
| Foreign-binary embed-and-exec | `embed` + `os/exec`; trodden | `include_bytes!` + `std::process` (uv, ruff precedent) | `with { type: "file" }` + `Bun.spawn`; younger |
| GFM Markdown | `goldmark` (mature) | `comrak` (mature) | `unified`/`remark-gfm` (mature) |
| OpenAPI v2 + v3 + 3.1 | `libopenapi` covers all in one | **Two crates required** (`openapiv3-extended` + `oas3`) | `@scalar/openapi-parser` (one) |
| `.proto` source parser | `bufbuild/protocompile` (Buf-backed) | `protox-parse` | `protobufjs` |
| MiniSearch index emission | Manual JSON shape (~300 LOC) | Manual JSON shape (~300 LOC) | **Trivial — `import MiniSearch`** |
| Tailwind 4 integration | Embed-and-exec the standalone CLI | Embed-and-exec (no Oxide crate) | `@tailwindcss/node` as a JS dep |
| Biome integration | Embed-and-exec | Embed-and-exec | `@biomejs/js-api` WASM, pure-portable |
| HTTP + WS + SSE | stdlib + `coder/websocket` | `axum` + `tokio-tungstenite` | `Bun.serve` (built-in) |
| File watching | `fsnotify` | `notify` | `chokidar` v5 |
| Compile-time / dev loop | **Fast** | Slow (1.5–4 min clean release) | **Fastest** (TS + Bun) |
| Solo/small-team velocity | High | Medium (borrow-checker tax in glue code) | High |
| Hiring pool | **Largest** | Medium | Large (TS) but Bun-specific is small |
| Risk of language/runtime churn | Low | Low | Medium (Bun's `--compile` still maturing) |
| Real-world precedent | Hugo, Caddy, Buf | Zola, uv, ruff | Few production CLIs at this scope yet |

### Where the options diverge most

- **The MiniSearch axis.** Bun is the only option where the search index isn't a format reverse-engineering exercise. If the MiniSearch JSON shape ever drifts in a way Go/Rust missed, only Bun is immune by construction.
- **The Tailwind/Biome axis.** Bun reduces "embed and exec foreign binaries" from a top-level concern to nearly nothing for the two largest payloads, replacing them with regular npm deps (one of which is WASM). Go and Rust both shell out.
- **The binary-size axis.** Go and Rust ship 10–20 MB; Bun ships 55–100 MB. For a docs CLI this is mostly a perception cost, not a functional one — but it is real and visible.
- **The "boring" axis.** Go is the most boring, in the best sense. Every constraint maps onto a 5+-year-old library. Rust is nearly as boring with one extra crate for OpenAPI. Bun's `--compile` + native-addon shipping is the youngest path of the three.

## Recommendation

**Default to Go.** It is the lowest-risk path that fully satisfies every constraint. The library ecosystem is mature on every dimension (`goldmark`, `libopenapi`, `bufbuild/protocompile`, `fsnotify`, `coder/websocket`, `embed`, `goccy/go-yaml`). The single-binary, six-target cross-compile story is the strongest of any candidate — better even than Rust's once you account for cross-OS friction. Real-world precedent (Hugo, Caddy, Buf) demonstrates the exact embedding+exec pattern at scale. Velocity on a small team will be highest here.

**Pick Rust instead if:**
- Build performance ends up materially differentiating against Hugo / MkDocs / Docusaurus on huge sites — measure, don't assume.
- The team has more Rust expertise than Go expertise.
- A 2× smaller pre-payload binary actually matters (it usually doesn't; payloads dominate).

**Pick Bun instead if:**
- We commit to TypeScript across the entire stack (build pipeline + bundled browser-side runtime + search), and the unification value beats the binary-size and native-addon-shipping risks.
- The team's strength is TypeScript and the cost of building cross-language muscle is high.
- We're willing to invest in a robust per-arch CI matrix from day one to keep `@tailwindcss/oxide` shipping clean across all six targets.

**Don't pick:** any of the outsiders, for the reasons in Option 4. Revisit Zig if 1.0 ships *and* an OpenAPI parser appears; revisit .NET if Microsoft adds cross-OS Native AOT.

### On the user-memory note about embedded JS interpreters

The stored guidance — "prefer runtime web-platform over build-time complexity; exhaust SW/Web Worker/IndexedDB before embedding JS interpreters in build binaries" — targets the anti-pattern of a Go/Rust binary embedding QuickJS/V8 to execute user-supplied JS at build time. It does **not** target Bun-the-whole-tool, because there's no host language and no embedded interpreter; the tool *is* TypeScript. The principle is tangential to this decision, not dispositive. Bun should be evaluated on its own merits above, not ruled out by analogy.

## Open Questions

1. **Search-runtime lock-in.** Should the browser-side search be MiniSearch specifically, or are we open to Pagefind / Lunr / a custom reader? If we're open, the "MiniSearch JSON emission from Go/Rust" objection weakens further, and Bun loses one of its main edges. Worth deciding before the language is locked.
2. **Per-platform vs all-in-one release artifacts.** If we ship one binary per `(os, arch)` (which CI naturally produces), the embedded-binary bloat numbers in the Go brief drop to one-sixth. Confirm this is the intended distribution model.
3. **Template engine.** In Go, `templ` (typed, codegen) vs `html/template` (stdlib, untyped) is a one-way door. In Rust, `minijinja` (runtime-loadable) is the natural fit because user theming requires runtime template loading. Decide before the prototype.
4. **Mermaid scope.** All briefs assume client-side Mermaid (emit fenced code, render in browser). If we ever want server-side Mermaid → SVG, that pulls a headless-browser dependency that none of the three candidates carry well.
