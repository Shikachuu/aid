# Prose and staleness audit: docs/PRODUCT_OVERVIEW.md, RESEARCH_stack.md, RESEARCH_competitors.md, RESEARCH_search.md

Biggest problem: all four docs are out of date. They describe a Go/Rust tool that does not exist yet. The repo is a Bun/TypeScript tool with working code. Style fixes alone will not fix that. Fenced code blocks are skipped for style but are flagged when [stale]. Excerpts below quote the docs exactly, so they keep the docs' non-ASCII characters.

---

## docs/PRODUCT_OVERVIEW.md

### Mechanical (grouped)

- [13] Em dashes in prose. Lines 1, 5, 9, 10, 11, 12, 13, 14, 18, 30, 34, 41, 55, 57, 61, 66, 68, 88, 96, 127, 137, 145, 208, 216, 218, 219, 220, 221, 222, 228, 230, 249, 250, 267, 278, 288, 306, 310, 321, 348, 349, 396, 415, 479, 480, 481, 482, 483. Lines 121, 122 and 295 are inside fences, so skip them. Pattern: "X — Y" -> "X. Y" or "X, Y". The `**Label** — text` bullets become `**Label.** Text`. Where a line has a separate finding below, that rewrite already handles the dash.
- [ASCII] En dashes. 153 "OpenAPI v2–v3" -> "OpenAPI v2-v3". 338 "`<h1>`–`<h6>`" -> "`<h1>` to `<h6>`".
- [ASCII][33] Unicode arrows in prose. 327, 328, 329 "`openpai` → matches `openapi`" -> "`openpai` matches `openapi`" (same pattern on 328 and 329). 331 "(`open` → `openapi`)" -> "(`open` matches `openapi`)". 463 "(user partials → bundled fallback)" -> "(user partial first, then the bundled default)".
- [ASCII] Line 467: "(ChatGPT, Claude, Gemini, …)" -> "(ChatGPT, Claude, Gemini)". The ellipsis is also wrong, because the enum has exactly three targets (src/core/config.ts).
- [17] Title-case headings, rewritten to sentence case:
  - 1 "# aid (all-in-docs) — Product Overview" -> "# aid (all-in-docs) product overview"
  - 3 -> "Executive summary"
  - 7 -> "Key differentiators"
  - 16 -> "Target use case"
  - 22 -> "Core concepts"
  - 24 "Single Binary, Batteries Included" -> "Single binary" (also [32], "batteries included" is a stock phrase)
  - 28 -> "Convention over configuration"
  - 32 -> "Multi-format, colocated"
  - 43 -> "LLM-ready by default"
  - 59 -> "Cross-format search"
  - 72 -> "CLI commands"
  - 100 "Project Structure & Routing" -> "Project structure and routing"
  - 102 -> "Required folder structure"
  - 125 -> "Folder-based routing model"
  - 147 -> "File type to page rendering"
  - 164 -> "Schema overview"
  - 212 -> "Template system"
  - 214 -> "Bundled templates"
  - 226 -> "Theming-first customization"
  - 239 -> "LLM integration"
  - 254 -> "Auto-exported page formats"
  - 265 -> "\"Open in AI\" button"
  - 282 -> "Cross-format search"
  - 308 -> "Per-format weights"
  - 323 -> "Typo tolerance"
  - 333 -> "What gets indexed"
  - 344 -> "Output files"
  - 355 -> "Bundled tooling"
  - 359 -> "Tooling inventory"
  - 373 -> "Bundling strategy"
  - 383 -> "Dev server"
  - 400 -> "Build and output"
  - 419 -> "Architecture overview"
  - 421 -> "High-level data flow"
  - 454 -> "Component map"
  - 475 -> "Appendix: future iterations"
  - Table header 361 "Bundling Strategy" -> "Bundling strategy"
- [15] Bold on every table cell label. 363-371 (every tool name) and 458-469 (every component name). Unbold them.
- [15] Bold labels standing in for headings. 247 "**What it contains:**", 389 "**Key behaviors:**", 406 "**Output contents:**". Use plain "It contains:", "It does the following:" and "The output contains:".

### Line findings

- 5 [13][27] "produces a cohesive, themed documentation site — complete with an LLM-friendly layer — using one CLI command." -> "One CLI command turns markdown, HTML, OpenAPI specs, and Protocol Buffer definitions into a static site with one shared theme, `.md` and `.json` page exports, and an `llms.txt` file."
- 9 [13][16] "**Single binary, zero dependencies** — one statically-linked executable contains everything: ..." -> "**Single binary.** One executable contains the Tailwind CSS compiler, Biome, the linters and formatters, the API reference renderers, and a dev server. Users install nothing else."
- 10 [13][29][3][27] "Each is rendered with the appropriate UI based on file type, producing a cohesive site with consistent styling and navigation." -> "**Colocated formats.** Markdown, HTML, OpenAPI (v2 and v3), and `.proto` files can share a directory. aid picks the renderer from the file type, and every page shares one layout and navigation."
- 11 [13][15][32] "Every page also ships an **"Open in AI" button** that hands the current page straight into ChatGPT, Claude, or other LLM chat interfaces in one click." -> "Every page has an \"Open in AI\" button that opens the page in ChatGPT, Claude, or Gemini." See [stale] below. The button does nothing yet.
- 12 [13][27][32] "get you from zero to docs site in seconds." -> "**Convention over configuration.** A fixed folder layout and one `aid.yaml` are all a project needs, and only `name` is required."
- 13 [13][27] "Theming applies uniformly across all page types — including OpenAPI and proto renderers — for a consistent look and feel." -> "One `main.css` sets colors, fonts, and design tokens for every page type, including OpenAPI and proto pages. aid derives the dark palette from the light tokens."
- 14 [13][30] "so the browser is query-ready the moment it loads — no client-side indexing pass." -> "The build writes a precomputed index, so the browser does not build one."
- 18 [13][33] "Teams and organizations that need ... — without managing a dozen tools, plugins, or build pipelines." -> "aid is for teams that publish API specs and proto definitions next to prose and do not want a separate tool for each format."
- 26 [29] "...and a development server are all embedded." -> "The `aid` executable embeds the Tailwind CSS 4 compiler, Biome, markdownlint, Spectral, Buf, the Scalar and proto reference UIs, and the dev server."
- 30 [13][27] "This convention means projects are immediately buildable — configuration is optional, not mandatory." -> "The generated project builds without further edits." This line also contradicts line 208, which says `name` is required.
- 34 [13][29][30][32] "aid treats every supported file type as a first-class page source. ... routing is purely path-based, and each file is rendered with the UI appropriate to its type:" -> "Any supported file type can be a page, and different types can share a directory. The route comes from the file path, and the file type picks the renderer:"
- 36 [27] "render as rich HTML" -> "render as HTML"
- 38 [27] "render with an embedded API reference UI." -> "render with the embedded Scalar API reference UI."
- 39 [27] "render with an embedded protocol buffer documentation UI." -> "render with aid's proto reference UI (`@aid/proto-ui`)."
- 41 [13] "`events.proto` — all become sibling routes" -> "`events.proto`. Each becomes a route with its own renderer, and all three share the templates, navigation, and styling."
- 45 [30] "aid automatically generates" -> "aid generates"
- 49 [29][3][30] "is generated at the site root, providing LLMs with ... programmatically." -> "The build writes `llms.txt` at the site root. It lists every page and tells LLMs how to fetch the `.md` and `.json` versions."
- 53 [3][27] "making the entire look and feel customizable without touching the template structure." -> "so changing tokens restyles every page without editing templates."
- 55 [7][13][15][23] "Crucially, theming is unified across **all renderers** — ... This means a single set of ..." -> "Markdown pages, HTML pages, the OpenAPI reference UI, and the proto reference UI all read the same `main.css`. One set of color and typography tokens styles every page type."
- 57 [13][32] "override any token if you need pixel control. ... — no plugin, no extra config." -> "Override any token to set it by hand. The framework includes the toggle, `prefers-color-scheme` handling, and dark styles for OpenAPI and proto pages."
- 61 [13][30] "Every page — markdown, HTML, OpenAPI operation, proto message — is part of one searchable corpus. ... queries it instantly — no in-browser indexing pass." -> "Markdown, HTML, and OpenAPI pages share one search index. The browser loads the precomputed index and queries it without building an index first." See [stale].
- 65 [33] "Full-text BM25-style ranking, not substring matching." -> "Ranking is full-text BM25, not substring matching."
- 66 [13] "Levenshtein typo tolerance — `openpai` still finds" -> "Levenshtein typo tolerance. `openpai` finds `openapi`, and `petsore` finds `PetStore`."
- 67 [14][33] "Per-format weights configurable in `aid.yaml`: boost ..., etc." -> "`aid.yaml` sets per-format weights, for example to rank OpenAPI pages above markdown pages."
- 68 [13] "Cross-format results — a query for `StreamEvent` returns" -> "Results from all formats rank in one list. A query for `StreamEvent` can return..."
- 76 [14] "Scaffold a new project: creates the required folder structure" -> "Creates the required folder structure and an `aid.yaml`."
- 77, 88 [accuracy] "hot reload" -> "live reload". src/dev/reload.ts reloads the whole page over SSE, which is not hot module replacement.
- 88 [13][30] "and configuration — and triggers hot reload in the browser automatically." -> "and configuration, and reloads the browser over Server-Sent Events after each rebuild."
- 96 [13][27] "— using the embedded toolchain with no external dependencies." -> "`aid lint` and `aid fmt` run the embedded tools over markdown, OpenAPI, proto, CSS, and HTML files."
- 127 [13][15][30] "**File types can be freely mixed within any directory** — routing is purely path-based, not type-based. ... `base_path: "/"` :" -> "File types can share any directory, because routing uses only the path. The examples below assume the default `base_path: \"/\"`:" (this also removes the space before the colon)
- 137 [13][29][27] "This colocation model means a single directory can contain ..." This is the fourth time the doc states colocation (see 10, 34, 41). Cut it.
- 139 [29][30] "**`_`-prefixed folders** are excluded from the route tree entirely." -> "The router skips any path that has a `_`-prefixed segment."
- 145 [16][13][30] "**Versioning-aware design**: the folder structure is intentionally flexible ... — version boundaries are a user-level convention, not a framework constraint." -> "aid has no versioning feature. Users can keep versions in folders (`docs/v1/`, `docs/v2/`), and aid routes them like any other folder."
- 151 [33][29] "GitHub Flavored Markdown + Mermaid diagrams. Frontmatter parsed for SEO metadata" -> "GitHub Flavored Markdown with Mermaid diagrams. aid reads SEO metadata (title, description) from frontmatter."
- 152 [29] "Rendered as-is within the site layout template." -> "Inserted as-is into the site layout template."
- 156 [29] "Every page ... is wrapped in the site layout template and receives consistent navigation" -> "aid wraps every page in the site layout template, so every page has the same navigation, header, footer, and styling."
- 162 [27] "generates it with sensible defaults." -> "generates it."
- 208 [13] "All fields have defaults — the minimal valid config only requires `name`." -> "Every field except `name` has a default, so the smallest valid config sets only `name`."
- 216 [13] "Handlebars — depends on the implementation language chosen" -> rewrite. See [stale].
- 218-222 [13][16] "**Markdown page** — renders ..." (the same pattern on all five bullets) -> "`PageMarkdown` renders the parsed markdown inside the site layout." Use the same form for `PageHtml`, `PageOpenAPI`, `PageProto` and `PageIndex`.
- 228 [13][26][29][30][27] "`main.css` is the primary customization surface. ... Dark mode is derived automatically ... a coherent dark counterpart" -> "Most teams only edit `main.css`. Its Tailwind 4 tokens (colors, fonts, spacing, radii) style every page type, and aid derives the dark palette from the same tokens." This also repeats 55 and 57.
- 230 [13][14][30][10] "aid uses it transparently. There is no "eject everything" step: aid resolves ... — without touching, copying, or maintaining any unrelated partials." -> "To override a template, put a `.tsx` file with the partial's name in `templates/`. aid resolves each partial by name at render time and falls back to the bundled default. Overriding one partial does not require copying the others."
- 241 [32] "aid treats LLMs as a first-class consumer of the documentation. Three mechanisms ship by default:" -> "aid ships three LLM features by default:"
- 245 [30][27] "aid automatically generates ... This file provides LLMs with a structured way to discover and consume the documentation." -> "The build writes `llms.txt` at the site root, following the llmstxt.org spec." Cut the second sentence.
- 249 [13][16] "**Table of contents** — a structured listing of every page" -> "A table of contents that lists every page."
- 250 [13][16] "**Format instructions** — how to access different representations" -> "Instructions for fetching each page in another format:"
- 251, 252 [33] "markdown/HTML", "OpenAPI/proto" -> "markdown and HTML", "OpenAPI and proto"
- 263 [27] "Markdown and HTML pages are consumable by LLMs as plain markdown. ..." This restates the table above it. Cut it.
- 267 [13][15][27][32] "includes an **Open in AI** button in the page chrome. Clicking it hands ... — ChatGPT, Claude, Gemini, and others — pre-seeded with a sensible prompt" -> "Every page has an \"Open in AI\" button. Clicking it opens the configured chat (ChatGPT, Claude, or Gemini) with a prompt that points at the page's `.md` or `.json` version."
- 278 [29][13][10][32] "The page's content is passed via ... so no API keys, accounts, or backend integrations are required — the click takes the user straight into their preferred LLM" -> "aid passes the page through each target's \"open with prompt\" URL, so the button needs no API key or backend."
- 284 [15][30] "aid's search is **frontend-only, instant on load, typo-tolerant, and aware of every supported file type**." -> "Search runs in the browser. One index covers markdown, HTML, and OpenAPI pages and ranks them with per-format weights from `aid.yaml`."
- 288 [13][30][10] "queries it instantly — no client-side indexing pass, no `addAll` loop, no spinner." -> "The browser loads it and queries it without an indexing pass."
- 306 [13][15][29] "**directly from Go/Rust** — no embedded JavaScript runtime is required" -> rewrite. See [stale].
- 310 [29][13][27] "Different file types yield different ranking signal. By default, ... are boosted over prose body text — a query for `getPets`" -> "By default, OpenAPI pages (weight 2.0) and proto pages (1.5) rank above markdown and HTML pages (1.0). A query for `getPets` should land on the API spec, not on the tutorial that mentions it."
- 321 [29][13] "Per-document weighting is applied via ... — no rebuild." -> "The browser applies the weights through MiniSearch's `boostDocument` at query time." See [stale].
- 325 [33] "Configurable as a fraction of term length (default `0.2` = up to 1 edit per 5 characters):" -> "`search.typo_tolerance` sets the allowed edit distance as a fraction of term length. The default `0.2` allows one edit per five characters. For example:"
- 331 [29][27] "returns useful results before the full term is typed." -> "Prefix matching is on, so `open` already matches `openapi`."
- 346 [29] "Two artifacts are produced at the site root:" -> see [stale].
- 351 [29] "Both are loaded lazily on first focus" -> "The browser loads the index on the first focus of the search box."
- 357 [15][27] "One of aid's core principles is **zero external dependencies**." -> "aid has no external runtime dependencies."
- 375 [29 x3] "are included as byte arrays ... they are extracted ... and executed" -> see [stale].
- 377-379 [10][26] "Eliminates ... / Ensures consistent tool versions ... / Keeps the distribution story simple: one binary, one download" -> "Users install no other tools, and every user runs the same tool versions."
- 387 [27] "provides a local preview environment with hot reload capabilities." -> "`aid dev` serves the site locally and reloads the browser after changes."
- 392 [29] "Triggers automatic browser reload when changes are detected" -> "Reloads the browser over Server-Sent Events after each rebuild"
- 396 [13][27] "The dev server is designed for fast iteration — change a markdown file, save, and see the result immediately." Cut it.
- 404 [27] "Compiles the entire documentation site into a directory of static files." This repeats line 92 word for word. Merge sections 3, 10 and 11.
- 415 [16][29][13] "**Deployment:** aid's responsibility ends at generating static files. The output directory can be deployed ..." -> "aid stops at writing static files. Any static host can serve the output directory, for example S3, GitHub Pages, Netlify, Cloudflare Pages, or nginx. aid has no deploy command."
- 452 [15][28][29] "The parser also feeds a parallel **search index builder** that tokenizes ..., emitted alongside ..." -> "Each renderer also returns search tokens. The search index builder collects them into one MiniSearch index and writes it next to the other output files."
- 462 [33] "GFM+Mermaid" -> "GFM with Mermaid"
- 469 [27] "(Biome, markdown/OpenAPI/proto linters)" -> "(Biome, markdownlint, Spectral, Buf)"
- 471 [25] "*Detailed architecture diagrams and subsystem breakdowns will be added in future iterations of this document.*" Cut it.
- 477 [15][25] "This document is the **first layer** of the technical overview." Cut it with the appendix.
- 479-483 [13][16] Each bullet uses the "**Label** — restates" pattern. Cut them with the appendix.

### [stale]

- 30, 76, 84, 104, 162: `aid init` "scaffolds" a project. In the code, `aid init` prints "not implemented" and exits 1 (src/cli/commands/init.ts).
- 104-123 (tree): this is not what `assets/scaffold/` holds. The scaffold has only `aid.yaml`, `main.css` and `docs/index.md`. It has no `static/`, `templates/` or `_partials/`. The tree also leaves out `main.css`, which is the default `stylesheet`.
- 166-206 (config block): `dir.static` (default `"static"`) is missing. It is in src/core/config.ts and schemas/aid.schema.json.
- 11, 241, 265-278, 467: The "Open in AI" buttons do nothing. `buildAiButtons` returns `[]` (src/core/ai-targets.ts), and the click handler is a stub (src/web/ai-button.ts). `AIButton.tsx` renders one plain button, never one button per target or a dropdown. `ai_targets` is not read anywhere. Line 267's "and others" is also wrong, because the enum is exactly chatgpt, claude and gemini.
- 14, 61, 68, 284, 340, 452, 466: The docs say search covers proto pages. src/core/search-index.ts:44 filters out `kind === "proto"`, and its comment says this is "until a proto renderer exists". A proto renderer now exists and produces `searchTokens` (src/renderers/proto/index.ts:45). This looks like a code bug as well as a doc error.
- 61, 67, 310: The docs say weights apply per field and per operation. The index has one document per page (route), and weights apply per page `type`.
- 14, 61, 288, 348: The index file is `search-index.<hash>.js`, not `search-index.js`.
- 290-304 (fence), 306, 452, 466: "constructs an inverted index in pure Go/Rust" and "writes ... directly from Go/Rust, avoids a goja/V8 dependency" are wrong. aid is Bun/TypeScript and calls `new MiniSearch(...)`, `addAll` and `toJSON()` at build time (src/core/search-index.ts).
- 297, 301, 346, 349, 371, 413: `minisearch.min.js` is not emitted. MiniSearch is pulled in through `import("minisearch")` inside the `aid-web.js` bundle (src/web/search.ts:97, scripts/bundle-web.ts). Only one search file is written.
- 321: "weight changes only require a config update - no rebuild" is wrong. The weights are stamped into page HTML at build time through `data-aid-search-weights` (SearchBox.tsx:38), so changing them needs a rebuild.
- 342: The stored fields are `type`, `title` and `url` (`SEARCH_STORE_FIELDS`). There is no stored snippet.
- 153, 369: "e.g., Scalar, Swagger UI, or Redoc" -> Scalar (`@scalar/api-reference`).
- 154, 370: "Embedded protocol buffer documentation UI" -> `@aid/proto-ui` (packages/proto-ui, React plus protobufjs).
- 216, 438 (fence), 463: "The template engine is TBD (e.g., Go `html/template`, Tera, Handlebars)" -> TSX components (src/theme/components/*.tsx) rendered by the custom JSX runtime (src/jsx-runtime.ts).
- 230: Template overrides do not work. `resolvePartial` in src/theme/partials.ts is a stub that always returns the bundled fallback. Overrides are planned as `.tsx` files, not as "named partials" in a template language.
- 140: "Shared HTML fragments or partials that templates can include". Nothing in the code includes files from `_` folders.
- 363-368, 375: The tooling table and the "byte arrays extracted to a temporary location" text are wrong. Actual tools:
  - Tailwind uses `@tailwindcss/node` plus `@tailwindcss/oxide`, called in-process (src/core/tailwind.ts).
  - Biome uses `@biomejs/js-api` (WASM).
  - Markdown lint and format use markdownlint (`markdownlint-cli2`).
  - OpenAPI lint uses Spectral (`@stoplight/spectral-*`). OpenAPI "format" is a `Bun.YAML` or JSON round trip that drops YAML comments (src/fmt/openapi.ts).
  - Proto lint and format use Buf (`@bufbuild/buf` native binary, embedded per target).
  - The markdown renderer is unified, remark, rehype and Shiki. Mermaid renders client-side.
  - Only the Buf and lightningcss native files are embedded per target (scripts/compile.ts).
- 393: "generated in-memory for speed" is wrong. The dev server builds into double-buffered directories on disk, `.aid/dev/build-a` and `.aid/dev/build-b` (src/dev/session.ts).
- 394: "Runs the Tailwind compiler in watch mode" is wrong. src/dev/watcher.ts watches the CSS dependency files and triggers a full rebuild.
- 9, 26: "statically-linked executable" claims more than the code does. The release targets are darwin and linux, x64 and arm64. Windows is disabled (scripts/compile.ts:62-63).
- 482: "Decision records ... implementation language" is already decided (Bun). Subsystem docs already exist: docs/BUILD.md, DEV_SERVER.md, HTML.md, LLMS_TXT.md. The config reference already exists: schemas/aid.schema.json.

---

## docs/RESEARCH_stack.md

### Mechanical (grouped)

- [13] Em dashes in prose. Lines 5, 14, 17, 28, 43, 48, 54, 58, 62, 84, 88, 93, 94, 108, 109, 117, 122, 128, 129, 130, 131, 132, 133, 134, 135, 136, 142, 148, 163, 168, 171, 184. The headings "### Option N — X" (28, 58, 84, 122) become "### Option N: X". The `**Lang** — text` bullets (128-136) become `**Lang.** Text`.
- [ASCII] En dashes. 56 "200–400 MB", 78 "8–20 MB", 80 "1.5–4 minute", 116 "~55–100 MB", 143 "~10–15 MB / ~8–20 MB / ~55–100 MB", 153 "1.5–4 min", 163 "10–20 MB ... 55–100 MB". Use a hyphen ("200-400 MB") or "to".
- [ASCII] Arrows. 102 "auto-upgrades 2.0 → 3.1" -> "upgrades 2.0 specs to 3.1". 191 "Mermaid → SVG" -> "Mermaid to SVG".
- [ASCII][33] Multiplication sign. 14 "{macOS, Linux, Windows} × {x64, arm64}" (rewrite below). 173 "2× smaller" -> "half the size".
- [ASCII] Star. 38 "4.8k★" -> "4.8k stars".
- [ASCII] Ellipsis. 7 "switch to X if…" -> "switch to X if...". Line 88's ellipsis is inside inline code, so leave it.
- [17] Headings. 1 "Implementation Language / Stack" -> "# Research: implementation language and stack for `aid`". 3 "Problem Statement" -> "Problem statement". 186 "Open Questions" -> "Open questions".
- [15][32] All-caps verdicts. 30 "**Verdict: STRONG FIT, lowest-risk default.**", 60 "**Verdict: STRONG FIT, slightly more friction ...**", 86 "**Verdict: MIDDLING-TO-STRONG, the radically different bet.**", 124 "**Verdict: RULE OUT for this product.**". Use lowercase, for example "Verdict: strong fit, lowest-risk default." Line 86 becomes "Verdict: medium-to-strong fit, the option least like the other two."
- [16] "**Label**: restates" lines. 50, 52, 54, 56 (Go), 78, 80, 82 (Rust), 111, 113, 115, 120 (Bun), 180. Use the "**Label.** new detail" form (rewrites below).
- [15] Bold in table cells. 107, 142, 143, 146, 148, 153 (twice), 155. Unbold them.

### Line findings

- 5 [13][27] "The decision is foundational — it gates library availability, distribution mechanics, and team velocity for years." -> "The language decides which libraries are available and how the binary is distributed."
- 7 [27] "evaluates a wide candidate set" -> "compares Go, Rust, Bun, and eight other languages, recommends a default, and lists when to pick each alternative."
- 11 [33] "Hard requirements that gate every candidate:" -> "Every candidate must meet these requirements:"
- 13 [33] "zero external deps." -> "no external dependencies."
- 14 [13][33] "**Cross-compile to {macOS, Linux, Windows} × {x64, arm64}** — six targets — ideally from a single CI host." -> "**Cross-compile to six targets.** macOS, Linux, and Windows on x64 and arm64, ideally from one CI host."
- 15 [16][33] "**Render**: GFM Markdown (+ frontmatter, + Mermaid source passthrough), HTML, OpenAPI v2 + v3" -> "**Rendering.** GFM Markdown with frontmatter and Mermaid source passthrough, HTML, OpenAPI v2 and v3, and `.proto` files."
- 17 [13] "in pure native code** — no embedded JS runtime" -> "in pure native code.** No embedded JS runtime at build time."
- 19 [33] "file watching + live reload" -> "file watching and live reload"
- 22 [33] "(target < 50 MB before embedded payloads)" -> "(under 50 MB before embedded payloads)"
- 23 [32] "Mature, single-binary precedent in the wild (a tool like ours ...)" -> "An existing single-binary tool of similar scope written in the language."
- 24 [33] "Hireable / community-contributable language." -> "A language that is easy to hire for and that outside contributors know."
- 32 [30][32][4] "actively maintained ... well-trodden by Caddy, Buf, Hugo, and dozens of Go CLIs of comparable scope. ... is the language's flagship feature." -> "A maintained pure-Go library exists for every hard constraint. Caddy, Buf, and Hugo ship bundled tools with `embed` and `os/exec`. Setting `GOOS` and `GOARCH` cross-compiles to any target."
- 34 [15] "**Library shortlist** (all pure Go, no CGO):" -> "Library shortlist (all pure Go, no CGO):"
- 40 [33] "adds codegen step but is type-safe + faster" -> "adds a codegen step but is type-safe and faster"
- 43 [13] "No recursive API — wrap manually" -> "No recursive API, wrap it by hand"
- 48 [13][30] "a flat structure (...) — straightforward `encoding/json` work. The MiniSearch maintainer specifically flattened" -> "a flat structure (...), so `encoding/json` can write it. The MiniSearch maintainer flattened..."
- 50 [16][33][26] "**Strengths**: simplest distribution story of any candidate; smallest dependency churn; ..." -> "**Strengths.** Go has the simplest distribution of any candidate, the least dependency churn, the fastest path to an MVP, and the largest hiring pool."
- 52 [16][32] "templating choice is a fork in the road" -> "**Weaknesses.** Error handling is verbose, Go has no sum types, and the choice between `templ` and `html/template` is hard to reverse."
- 54 [16][13] "**Real-world precedent**: Hugo, Caddy, Buf, MinIO — all production ..." -> "Hugo, Caddy, Buf, and MinIO are production single-binary Go tools that embed assets and run bundled tools."
- 56 [16][33] "**Gotchas**: keep `CGO_ENABLED=0` ...; embedding all 6 platform variants of Tailwind+Biome bloats to 200–400 MB unless ..." -> "**Gotchas.** Keep `CGO_ENABLED=0` so cross-compiling keeps working. Embedding all six platform builds of Tailwind and Biome grows the binary to 200-400 MB, unless each release artifact targets one platform through build tags."
- 62 [33][13][15][32][30] "All hard constraints satisfied. ... **Zola** — essentially the architecture we're describing ... would have been a Rust-only superpower, is officially **not happening** — ... like everyone else." -> "Rust meets every hard constraint, and its libraries are mature. Zola is a Rust tool with the same architecture. Tailwind maintainers declined to publish Oxide as a Rust crate (discussion #16191), so a Rust build would run the Tailwind standalone binary."
- 74 [27] "Settled choice" -> "Most-used pairing"
- 75 [27] "Standard" -> "Most-used watcher"
- 78 [16][33][32] "**Strengths**: smallest binaries ...; `rayon` parallelism for builds is best-in-class; precedent (uv, ruff, Zola) for exactly this ..." -> "**Strengths.** Rust produces the smallest binaries (8-20 MB before payloads) and has the strongest type system. `rayon` parallelizes builds. uv, ruff, and Zola ship the same way."
- 80 [16][28][33][27] "...costs measurable solo/small-team velocity for a tool that isn't memory- or perf-critical." -> "**Weaknesses.** Clean release builds take 1.5 to 4 minutes. OpenAPI support is split across two crates. Borrow-checker friction in glue code (template lifetimes, `RefCell` in AST traversal) slows a small team, and this tool is not memory- or performance-critical."
- 82 [16][33] "`serde_yaml` situation; `*-unknown-linux-musl` for genuine static Linux" -> "**Gotchas.** `serde_yaml` is unmaintained. A fully static Linux binary needs the `*-unknown-linux-musl` target. Cross-compiling for macOS from Linux CI needs the macOS SDK injected."
- 88 [32][33][13] "bakes the runtime + your TS + assets into a single executable. The runtime is *inside* the binary — still one file, no external deps" -> "The whole tool is TypeScript. `bun build --compile --target=bun-darwin-arm64 ...` packs the Bun runtime, the code, and the assets into one executable. Users still download one file."
- 90 [15][30] "**Why this is genuinely different:**" -> "How this option differs:"
- 92 [32][33] "It IS a JS library. `import MiniSearch`, build the real index in-process, ... No format reverse-engineering, no `serializationVersion` drift risk." -> "**MiniSearch runs in-process.** The build imports MiniSearch, builds the index, and writes `JSON.stringify(ms.toJSON())`. aid does not reimplement the format, so it cannot drift from `serializationVersion`."
- 93 [13][32][33] "**Tailwind 4 stops being "embed and exec a binary."** ... — used as a regular npm dep. No extract-to-tempdir ceremony." -> "**Tailwind 4 is an npm dependency.** `@tailwindcss/node` is a programmatic API over `@tailwindcss/oxide`, so aid does not extract a binary to a temp directory."
- 94 [13][32] "WASM is portable across all targets — zero per-arch headaches." -> "**Biome is an npm dependency.** `@biomejs/js-api` wraps `@biomejs/wasm-nodejs`, and the WASM build runs on every target without a per-architecture package."
- 95 [33] "Build pipeline, browser-side glue, and search index all share" -> "The build pipeline, the browser code, and the search index share one TypeScript codebase."
- 97 [15] "**Library shortlist (all npm, all pure JS unless flagged):**" -> unbold it.
- 101 [27] "Standard pipeline" -> "Most-used pipeline"
- 105 [32] "Battle-tested" -> "Widely used" (see [stale])
- 106 [33] "Zero npm dep" -> "No npm dependency"
- 107 [15][32] "**The killer feature** of this option" -> "Main advantage of this option"
- 108 [13] "Native addon — see risk below" -> "Native addon, see the risk below"
- 109 [13][33] "Pure WASM — no per-arch worry" -> "Pure WASM, no per-architecture package"
- 111 [16][33][27][4] "**Bun > Deno for this product**: ... better `Bun.serve`, better npm compat (~98% vs ~95%)" -> "Bun fits this product better than Deno. Bun can target `bun-windows-arm64`, and Deno's `--target` cannot. Bun reports about 98% npm compatibility against Deno's 95% [cite the source]. Bun also has built-in TypeScript, JSX, SQLite, and embedded-file APIs." Drop "better `Bun.serve`", because it is unsupported.
- 113 [16][33][27][32] "fastest TypeScript DX; smallest gap between "what it does" and "what you write" ...; reuses the largest library ecosystem on earth." -> "**Strengths.** Bun has the fastest TypeScript edit-and-run loop. The search code calls MiniSearch directly. The tool can use any npm package."
- 116 [33][32] "Defensible against MkDocs/Docusaurus, looks heavy next to a 12 MB Go binary." -> "The binary is at least 55-100 MB because the runtime ships inside it. That is similar to installing MkDocs or Docusaurus, and large next to a 12 MB Go binary."
- 117 [13][32][29] "works but isn't yet boring — historical bug tail around Windows/WSL/ARM. Each release must be tested" -> "Embedding `.node` files in `bun build --compile` output works, but it has a history of bugs on Windows, WSL, and ARM. CI has to test each release on every target architecture."
- 118 [27] "edge cases around dynamic `require`, worker threads, and Windows code-signing remain rough." -> "has open issues with dynamic `require`, worker threads, and Windows code signing." This matters because aid uses worker threads (src/workers/pool.ts).
- 120 [16][28][30][27] "**Gotchas**: explicitly static `require(...)` per target to ensure ...; if the oxide native-addon path is too painful, fall back ..." -> "**Gotchas.** Each target needs a static `require(...)` of its own oxide `.node` file so the compiler embeds the right one. If the native addon causes too many failures, embed the Tailwind standalone binary instead."
- 122 [13][32] "Option 4 — Outsiders (Zig, ...)" -> "### Option 4: other languages (Zig, ...)"
- 126 [15][33][32][30] "The decisive constraints are **(a) one-host cross-compiles-everything** and **(b) ... AND ...**. Only Go and Rust clear both bars cleanly" -> "Two constraints decide this group. One CI host must cross-compile every target, and one ecosystem must have mature parsers for both `.proto` source and OpenAPI v2 and v3. Go and Rust meet both, and Bun meets both through npm. Per language:"
- 128 [13][15][32][33] "Best cross-compile of any language; killer `@embedFile`; ... Pre-1.0 churn (0.16 brings another breaking wave). MIDDLING if ..." -> "**Zig.** Zig has the best cross-compilation of any language, `@embedFile`, and a good `.proto` parser (`mattnite/protobuf`). It has no mature OpenAPI parser, and 0.16 brings more breaking changes before 1.0. Reconsider if 1.0 ships and an OpenAPI parser appears."
- 129 [13][15][33] "**Native AOT does not support cross-OS compilation** — must build on each target OS." -> "**.NET 9 and 10 Native AOT.** .NET has the best libraries of this group (Markdig, Microsoft.OpenApi.NET, protobuf-net). Native AOT cannot cross-compile between operating systems, so each target OS needs its own build host. Rule it out unless Microsoft adds cross-OS AOT."
- 130 [13][15][32] "Apple-blessed libraries; ... **No clean Windows static binary cross-compile**" -> "**Swift.** Apple maintains the libraries, and the static Linux SDK works. Swift cannot cleanly cross-compile a static Windows binary, and its `.proto` source parser is weak. Rule it out."
- 131 [13][27] "Beautiful language, no OpenAPI parser" -> "**OCaml.** OCaml has no OpenAPI parser, weak Windows cross-compilation, and a small hiring pool. Rule it out."
- 132, 133 [13] -> "**Nim.** ...", "**Crystal.** ..." with whole sentences.
- 134 [13][33] "Cross-OS cross-compile painful, hiring pool tiny, GHC-on-Alpine fragility." -> "**Haskell.** Haskell has `cmark-gfm` (C bindings), `openapi3` (3.0 only), and `proto-lens`. Cross-OS compilation is painful, GHC on Alpine is fragile, and the hiring pool is small. Rule it out."
- 135 [13][33][27] "Greenfield 2026; opportunity cost dominates." -> "**C++.** A new C++ codebase in 2026 costs more effort than Go or Rust and gains nothing here. Rule it out."
- 136 [13][33][26][27] "**Roc / Gleam / V** — pre-1.0, no native binary story (Gleam), or credibility issues (V)." -> "**Roc, Gleam, and V.** Roc is pre-1.0, Gleam has no native binary output, and V has [name the specific issue]. Rule them out."
- 142 [15][13][32] "**Best in class** — flagship feature" -> "Best: built in through `GOOS` and `GOARCH`"
- 144 [32] "trodden" -> "widely used"
- 148 [15][13] "**Trivial — `import MiniSearch`**" -> "Uses MiniSearch directly"
- 153 [33] "**Fastest** (TS + Bun)" -> "Fastest (TypeScript on Bun)"
- 161 [32][33] "only Bun is immune by construction." -> "**MiniSearch.** Only Bun builds the index with MiniSearch itself instead of reimplementing its JSON format. A format change reaches Bun through a package update. A Go or Rust emitter would need a code change."
- 162 [3][28][33] "Bun reduces "embed and exec foreign binaries" from a top-level concern to nearly nothing ..., replacing them with regular npm deps" -> "**Tailwind and Biome.** Bun loads both as npm dependencies (Biome as WASM), so neither needs an embed-and-exec step. Go and Rust run both as child processes."
- 163 [13][30] "this is mostly a perception cost, not a functional one — but it is real and visible." -> "**Binary size.** Go and Rust binaries are 10-20 MB, and Bun binaries are 55-100 MB. The larger download does not change behavior, but users will notice it."
- 164 [32][33] "Go is the most boring, in the best sense. ... Bun's `--compile` + native-addon shipping" -> "**Maturity.** Every Go library on the list is more than five years old. Rust matches that except for a second OpenAPI crate. Bun's `--compile` and native-addon embedding are the newest of the three."
- 168 [30][26][13][33][27] "fully satisfies ... cross-compile story is the strongest ... — better even than Rust's ... embedding+exec ... Velocity on a small team will be highest here." -> rewrite or mark as superseded (see [stale]).
- 171 [30][13][32] "materially differentiating ... — measure, don't assume." -> "Build speed on large sites turns out to matter against Hugo, MkDocs, and Docusaurus. Measure it first."
- 173 [30] "actually matters (it usually doesn't; payloads dominate)" -> "A binary half the size before payloads matters. It usually does not, because the payloads make up most of the size."
- 176 [33][28] "(build pipeline + bundled browser-side runtime + search), and the unification value beats ..." -> "We want TypeScript for the build pipeline, the browser runtime, and search, and one language is worth the larger binary and the native-addon risk."
- 177 [32] "cross-language muscle" -> "The team knows TypeScript better than Go or Rust."
- 178 [27][32] "robust per-arch CI matrix from day one to keep `@tailwindcss/oxide` shipping clean" -> "We will run CI on every target architecture from the start, to catch `@tailwindcss/oxide` breakage."
- 180 [16][14] "**Don't pick:** any of the outsiders" -> "Do not pick any language from Option 4. Revisit Zig if 1.0 ships and an OpenAPI parser appears. Revisit .NET if Microsoft adds cross-OS Native AOT."
- 184 [13][15][31][29] "The stored guidance — ... It does **not** target Bun-the-whole-tool ... not dispositive. Bun should be evaluated on its own merits" -> "A project guideline says to prefer browser features over embedding a JS interpreter in the build binary. That guideline targets a Go or Rust binary that embeds QuickJS or V8. A Bun build embeds no interpreter, so the guideline does not apply." Better to cut it (see the end).
- 188 [30][33] "MiniSearch specifically ... Worth deciding before the language is locked." -> see [stale]
- 190 [32] "is a one-way door" -> "is hard to reverse"
- 191 [33] "All briefs assume" -> "This brief assumes". There is only one brief.

### [stale]

- 5, 166-180: The doc says "The implementation language has not been chosen" and recommends "Default to Go." The project chose Bun and TypeScript (package.json, scripts/compile.ts, mise.toml). Add a status line at the top: "Decision: Bun `--compile`. This brief is kept for history." Either mark the Recommendation as superseded or rewrite it as the decision record.
- 14, 142, 178: "six targets" and "Windows ARM64 supported". aid ships four targets (darwin and linux, arm64 and x64). Windows is commented out in scripts/compile.ts:62-63.
- 17: "MiniSearch-format index in pure native code, no embedded JS runtime". The project dropped this constraint. src/core/search-index.ts builds the index with MiniSearch in JS.
- 18: "Embed and extract foreign binaries (Tailwind 4 standalone, Biome, ...)". aid embeds only the Buf and lightningcss natives. Tailwind runs through `@tailwindcss/node` and Biome through WASM.
- 104: "`yaml` (eemeli)". The code uses `Bun.YAML` (src/core/config.ts), and `yaml` is not a dependency.
- 105, 152: "`chokidar` v5". The code uses recursive `fs.watch` (src/dev/watcher.ts), and chokidar is not a dependency.
- 103: `protobufjs` is correct, but it is a dependency of `packages/proto-ui`, not the root.
- 188-191: All four open questions are resolved.
  - MiniSearch is chosen (`"minisearch": "^7"`).
  - Release artifacts are per platform (compile.ts).
  - Templates use the custom JSX runtime (src/jsx-runtime.ts).
  - Mermaid renders client-side (src/web/mermaid-entry.ts).

---

## docs/RESEARCH_competitors.md

### Mechanical (grouped)

- [13] Em dashes. Lines 3, 9, 14, 15, 17, 25, 26, 27, 45, 48, 62, 83, 84, 85, 90, 96, 97, 98, 99, 119, 129, 130, 137, 138, 139, 144. The `**Label** — text` bullets become `**Label.** Text`.
- [ASCII] En dashes. 45 "~2022–2024", 56 "$300–$600/mo", 68 "8–11 ... 2–3", 75 "1–2 days / 2–3", 76 "4–5", 77 "1–2 days / low–medium / 3–4", 79 "1–2 days / 3–4 / 2–3", 80 "3–6 days / 0.5–1 day/qtr / 6–8". Use a hyphen.
- [ASCII] Arrows. 78 "(everything → markdown)" -> "(everything converted to markdown)". 85 "Tailwind 3→4" -> "Tailwind 3 to 4". 112 and 113 "→" -> rewrites below.
- [ASCII] Ellipsis. 80 "Hugo + …" -> "Hugo, and others".
- [ASCII][18] The check, warning and cross emoji in the legend (31) and the matrix rows (35-43, and the text on 48). Replace them with words: `yes` / `partial` / `no`. Legend 31 -> "Legend: yes = native, partial = partial or via plugin, no = missing or stale."
- [ASCII] Superscripts. 37, 45 "¹" and 37, 46 "²" -> "[1]" and "[2]".
- [17] Headings.
  - 1 -> "# Research: aid compared with other documentation tools"
  - 5 -> "Problem statement"
  - 11 -> "## Constraints" (drop the parenthetical; [33])
  - 21 -> "Options evaluated"
  - 29 "Capability Matrix (the headline)" -> "Capability matrix" ([27])
  - 50 "The \"Closest Competitors\"" -> "Closest competitors"
  - 67 "Roll-Your-Own Pipeline" -> "Custom pipeline"
  - 70 -> "Migration effort if we drop aid"
  - 87 "Where aid Genuinely Differentiates" -> "Where aid differs" ([30])
  - 94 -> "Where aid loses"
  - 101 -> "Viability verdict"
  - 115 -> "Biggest risk to aid"
  - 134 -> "Open questions"
- [33] "+" between nouns in headings and prose. 61, 64 (headings) and 7, 15, 17, 18, 25, 27, 41, 53, 56, 62, 68, 74-80, 89, 96, 103, 105-108, 127, 140. Use "and" or a comma list.
- [15] Bold mid-sentence. 7, 9, 38, 39, 48, 53 (three times), 56, 59, 62, 68, 80 (whole row), 89, 90, 103, 110, 112, 113, 117, 126, 128. Unbold the ones not covered by rewrites below.
- [11] Synonym cycling. The same thing is called "Roll-your-own" (33, 80), "Roll-Your-Own Pipeline" (67), "roll-your-own" (137) and "C. Roll-your-own pipeline" (27). Pick "custom pipeline" and use it everywhere.

### Line findings

- 3 [13] "_Date: 2026-05-10 — May 2026_" -> "_Date: 2026-05-10_"
- 7 [28][33][15] "is a *planned* single-binary, zero-dep static documentation generator that handles markdown + HTML + ..." -> "aid is a single-binary static documentation generator. It renders markdown, HTML, OpenAPI v2 and v3, and Protocol Buffers as colocated, path-routed pages. One Tailwind 4 theme styles every renderer. aid bundles linters and formatters and writes `llms.txt` plus per-page `.md` and `.json` exports."
- 9 [13][15] "The repo currently has **only this spec** — no code." -> "When this brief was written, the repo had only the spec." See [stale].
- 13 [33] "zero runtime deps (no Node/Python/JVM)" -> "**Single binary.** No runtime dependency on Node, Python, or a JVM."
- 14 [13][33] "md/html/yaml/proto as siblings in any folder, type-dispatched renderer." -> "**Colocated formats.** Markdown, HTML, OpenAPI, and proto files sit side by side in any folder, and the file type picks the renderer."
- 15 [13][9] "— not just markdown reference dumps." -> "**Interactive OpenAPI and proto UIs.** Both render as interactive reference pages, not static markdown."
- 16 [33] "across prose AND OpenAPI ref UI AND proto UI." -> "**One Tailwind 4 theme** for prose, the OpenAPI reference UI, and the proto UI."
- 17 [13][33] "**LLM-ready by default** — `.md`/`.json` URL exports + spec-compliant `llms.txt`." -> "**LLM exports by default.** Each page has `.md` or `.json` versions, plus a spec-compliant `llms.txt`."
- 18 [33] "**Bundled lint/fmt** for markdown + OpenAPI + ..." -> "**Bundled linting and formatting** for markdown, OpenAPI, proto, CSS, and HTML."
- 19 [33] "(deployable to S3/Pages/nginx, no runtime needed)" -> "Static output that S3, GitHub Pages, or nginx can serve without a runtime."
- 23 [30] "Three radically different families:" -> "Three families of tools:"
- 25-27 [13][33] -> "**A. General-purpose static site generators with plugins.** Docusaurus, ...", "**B. API-doc-first products.** Mintlify, ...", "**C. Custom pipeline.** Scalar or Redocly CLI, protoc-gen-doc or sabledocs, Hugo or Zola, Tailwind standalone, Spectral, Buf, Biome, and a custom llms.txt script."
- 41 [33] "One CLI: lint+fmt across md/OpenAPI/proto/CSS/HTML" -> "One CLI lints and formats markdown, OpenAPI, proto, CSS, and HTML"
- 45 [13][30] "— both effectively unmaintained since ~2022–2024." -> "[1] `docusaurus-protobuffet` (last release May 2024) and `pseudomuto/protoc-gen-doc` (last release February 2022) are unmaintained."
- 46 [33] "not a static-output SSG; light/dark theming only, no custom themes." -> "[2] Buf BSR has proto docs, but it is a hosted registry, not a static site generator. It offers light and dark themes only."
- 48 [13][accuracy] "**No row is fully ✅ except aid itself.** That said — aid doesn't exist yet" -> "No column except aid's is all yes." The matrix uses columns for tools, so "row" is wrong. See [stale].
- 53 [15][33][16] "The **only** competitor with ... **But:** Node CLI (not a binary), ..." -> "Fern is the only competitor that handles OpenAPI, Protobuf and gRPC, and prose in one tool. Its CLI runs on Node, it centers on a hosted runtime, and Postman acquired it in January 2026, which makes its direction uncertain. It fits teams that accept a Node toolchain and a commercial product."
- 55 [33] "(closest on *DX*)" -> "(closest on developer experience)"
- 56 [33][27][15] "Polished prose+OpenAPI+llms.txt+AI search, slick theming. **No proto support whatsoever**" -> "Mintlify handles prose, OpenAPI, llms.txt, and AI search, and its themes are easy to customize. It has no proto support. It is SaaS-only at $300-$600 per month plus per-seat fees, and the output is served only from Mintlify's CDN."
- 59 [33][26][32][30] "**No proto story**, and the OpenAPI UI is a styled island that doesn't truly unify" -> "Hugo is a single Go binary with OpenAPI shortcodes (Swagger UI and Redoc embeds) and a community llms-txt module. It has no proto support, and the embedded OpenAPI UI keeps its own styles instead of the prose theme."
- 62 [33][30][13] "Most complete OSS combo for OpenAPI + prose. Plugin actively maintained ... **last released May 2024** — stale." -> "This is the most complete open-source setup for OpenAPI and prose. The OpenAPI plugin is maintained (v4.7.1, January 2026). The proto plugin, `docusaurus-protobuffet`, last released in May 2024. Theming uses React and Infima, not Tailwind, and the OpenAPI panel inherits only part of the prose styles."
- 65 [26][33] "Best theme-uniformity story among JS SSGs. Still no proto plugin. Node-required." -> "Starlight keeps OpenAPI pages closest to the prose theme among JS static site generators. It has no proto plugin and requires Node."
- 68 [32][33][15] "Realistic shopping list: ... **8–11 separate tools across 2–3 ecosystems.**" -> "A realistic set is Scalar CLI, Spectral, Buf, protoc-gen-doc or sabledocs, Hugo or Zola, Tailwind standalone, Biome, markdownlint-cli2, and a custom llms.txt walker. That is 8-11 tools across 2-3 ecosystems."
- 72 [26] Column header "Theme surfaces to reconcile" -> "Themes to reconcile"
- 82 [4] "Real-world friction (well-documented in community blogs):" -> "Real-world friction:". Either drop the attribution or link the blogs.
- 83 [13][32][16] "**Theme drift** — Redoc actively fights embedding (it owns the page chrome); ... first-class CSS-variable theming" -> "**Theme drift.** Redoc controls the whole page layout, which makes it hard to embed. Scalar is the only OpenAPI renderer themed through CSS variables. Each proto renderer ships its own templates and CSS."
- 84 [13][32][33] "**Proto-doc renderer rot** — ... `sabledocs` is small/Python; ... is on borrowed time or writing their own renderer." -> "**Unmaintained proto renderers.** `pseudomuto/protoc-gen-doc` last shipped in February 2022, `sabledocs` is a small Python project, and `docusaurus-protobuffet` last shipped in May 2024. Teams that want themed proto docs in 2026 must maintain a fork or write their own renderer."
- 85 [13][33] "— silent CI breakage." -> "**Version drift between tools.** Tailwind 3 to 4, Node major versions, Spectral ruleset updates, the Docusaurus 3.10 Tabs API refactor, and Buf's protobuf v34 breaking changes (planned for 2026 Q1) can each break CI without warning."
- 89 [33] "**Single binary that bundles interactive OpenAPI + proto renderers + theme + lint/fmt + dev server.** No competitor delivers this." -> "**One binary with every piece.** It bundles interactive OpenAPI and proto renderers, the theme, linting and formatting, and the dev server. No competitor does this."
- 90 [30][32][15][13] "Essentially no maintained interactive proto-doc UI exists in OSS. This is the strongest moat **and** the hardest piece ... — aid will need to ship its own" -> "No maintained open-source interactive proto UI exists. This is aid's strongest advantage and was its hardest piece. aid now ships its own (`packages/proto-ui`)."
- 92 [33][14] "**Air-gappable, no-Node, no-SaaS, no-per-seat, no-vendor-acquisition-risk.** Concrete buyer profile: ..." -> "**Works offline, with no Node, SaaS, per-seat fee, or vendor.** Likely buyers are regulated industries (finance, defense, health), docs-as-code teams in engineering orgs, and teams that use gRPC or Connect heavily."
- 96 [13][33] "**Pure markdown + OpenAPI** (no proto) — ... aid's advantage shrinks to "single binary" alone." -> "**Markdown and OpenAPI without proto.** Hugo, Docusaurus, Starlight, and MkDocs already cover this, so aid's only advantage is the single binary."
- 97 [13][33][27] "**Hosted-search / AI-chat / analytics / customer-key-injection** — ... cannot compete on UX richness." -> "**Hosted search, AI chat, analytics, and customer key injection.** Mintlify, ReadMe, Fern, Scalar Cloud, Bump.sh, and Redocly Realm sell these features. aid is static and self-hosted and has none of them."
- 98 [13][32] "**Existing AsciiDoc shops** — Antora is entrenched." -> "**AsciiDoc users.** Most already use Antora, and aid does not read AsciiDoc."
- 99 [13] "**Marketing reach** — Mintlify and Docusaurus ..." -> "**Marketing reach.** Mintlify and Docusaurus have name recognition that aid will not match."
- 103 [32][33] "**aid's exact intersection is unoccupied.** No tool today ships single-binary + OpenAPI + ..." -> "**No other tool covers aid's full feature set.** None combines a single binary, OpenAPI, proto, one theme, llms.txt, and bundled linting and formatting. The closest tools each miss at least two:"
- 105-108 [33] "single-binary + air-gappable", "interactive proto + OpenAPI theme unity", "single-binary + has stale proto plugin", "proto + self-host" -> "and" plus whole clauses, for example "Fern has no single binary and cannot run offline." Also "Hugo/Zola", "Mintlify/ReadMe" -> "Hugo and Zola", "Mintlify and ReadMe".
- 110 [15] "**But** the value of that intersection depends on how you frame the buyer:" -> "The value of that combination depends on the target buyer:"
- 112 [15][32] "Pitched as **"docs tool for teams whose APIs are gRPC-first ..."** → the value case is sharp." -> "Pitched as a docs tool for teams with gRPC-first or mixed gRPC and REST APIs, aid fills a real gap. No maintained tool renders themed proto docs now that `protoc-gen-doc` has stalled."
- 113 [15][32] "→ Hugo/Docusaurus eat its lunch on community, plugins, and battle-tested reliability." -> "Pitched as another static site generator, aid loses to Hugo and Docusaurus, which have larger communities, more plugins, and years of production use."
- 117 [26][15] "does not exist as a polished OSS primitive" -> see [stale]
- 122 [27] "the third is a substantial engineering investment." -> see [stale]
- 126 [15][32] "**aid is viable, but only with a sharpened pitch:**" -> "aid is viable if the pitch is narrowed:"
- 127 [33] "Lead with proto + OpenAPI + prose unification" -> "Lead with proto, OpenAPI, and prose in one site."
- 128 [15] "Validate the proto-renderer plan **first**" -> see [stale]
- 129 [13][32][33][30] "Lean hard on the air-gap / no-vendor-lock / no-per-seat angle ... structurally cannot follow." -> "In marketing, stress that aid works offline, has no vendor lock-in, and has no per-seat fee. SaaS competitors cannot offer these."
- 130 [13][33] "Make llms.txt a prominent default — ... regression vs. competitors." -> "Generate llms.txt by default. Mintlify and Redocly already do, so leaving it out would put aid behind them."
- 132 [32] "If those two collapse, the project becomes ..." -> "If (1) and (2) hold, aid fills a gap no tool covers. If they fail, aid is another single-binary static site generator and competes with Hugo from a weaker position."
- 136 [26][30][33] "significantly affects the bundling story" -> see [stale]
- 137 [13][26] "Scalar (best theming primitives)" -> see [stale]
- 140 [26][33] "mixed REST+proto in finance/regulated verticals the better wedge?" -> "Is gRPC-first the right first market, or are teams with mixed REST and proto APIs in finance and other regulated industries a better one?"
- 144 [13][4][27] "(Cited throughout — full URL list available in the parallel research outputs; key references: ...)" -> List the URLs, as RESEARCH_search.md does. "Cited throughout" is false, because the body has no inline citations. Readers of the repo cannot see "parallel research outputs".

### [stale]

- 7 "*planned*", 9 "The repo currently has only this spec - no code", 48 "aid doesn't exist yet". The code exists, with five feature commits through 8ec23a6.
- 90, 115-122, 128, 138: The proto UI risk is resolved. aid built its own: `packages/proto-ui`, React plus `protobufjs`, wired through src/renderers/proto and src/web/proto-entry.ts. Line 119 "hard to embed in a Go/Rust binary" also assumes the old language. Replace 115-122 with a one-line resolved note.
- 136: The language is decided (Bun and TypeScript).
- 137: The OpenAPI UI is decided (`@scalar/api-reference`).
- 139: Tailwind packaging is decided (`@tailwindcss/node` plus `@tailwindcss/oxide` npm dependencies, with natives staged per target).
- 35 (aid column, "Single binary"): The aid column should note that macOS and Linux are supported and Windows is not (scripts/compile.ts).

---

## docs/RESEARCH_search.md

### Mechanical (grouped)

- [13] Em dashes in prose. Lines 3, 9, 11, 21, 26, 50, 52.
- [ASCII] En dashes. 14 "100–5000+", 20 "2024–25", 23 "4.5–16KB" and "2024–25", 96 "2024–25". Use a hyphen or "to".
- [ASCII] Arrows in prose. 23 "\"openpai → openapi\" misses", 46 "\"openpai → openapi\" ... \"petsore → PetStore\"", 85 "after first load → zero parse cost", 93 "\"openpai → openapi\"". Lines 60-63 are inside the fence, so skip them. Rewrites below.
- [17] Headings.
  - 1 -> "# Research: frontend-only search library for aid"
  - 5 -> "Problem statement"
  - 16 -> "Candidates evaluated"
  - 30 "Why MiniSearch Wins" -> "Why MiniSearch won"
  - 50 "Chosen Architecture: Option A — Build-Time Index Emission, Reuse MiniSearch Runtime" -> "## Chosen architecture: build-time index, MiniSearch runtime" (also [13])
  - 89 "Why Option A over alternatives" -> "Why this design over the alternatives". "Option A" is never defined against an Option B.
  - 98 -> "Open questions"
- [15] Bold. Every MiniSearch cell on line 20 and "**WINNER**" -> "Winner". Also 7 "**cross-format search**", 13 "**per-document-type**", 14 "**no in-browser indexing pass**", 23 "**Phonetic only**", 27 "**No**", 52 "**directly from Go/Rust**". Unbold them.
- [16] "**vs. X**: ..." label-colon bullets at 90, 91, 92, 93 -> "**X.** ..." (rewrites below).

### Line findings

- 3 [13] "_Date: 2026-05-10 — May 2026_" -> "_Date: 2026-05-10_"
- 9 [13][30] "Runs entirely in the browser — no server." -> "Runs in the browser with no server."
- 11 [13] "Has typo tolerance (Levenshtein) — users will misspell" -> "Has Levenshtein typo tolerance. Users will type \"openpai\" for \"OpenAPI\"."
- 12 [29] "Loads a precomputed index emitted at compile time by the aid binary (Go or Rust)." -> "Loads a precomputed index that `aid build` writes." See [stale].
- 14 [15] "Scales to 100–5000+ pages with **no in-browser indexing pass**." -> "Scales to 100 to 5000+ pages without building the index in the browser."
- 21 [13] "Runner-up — drops typo tolerance" -> "Runner-up, no typo tolerance"
- 22 [27] "Hacky (custom sorter)" -> "Needs a custom sorter"
- 24 [33] "~800ms@10k items" -> "~800 ms at 10k items"
- 26 [13] "Skip — sunset" -> "Skip, discontinued"
- 20 vs 67, 75 [11] The bundle size is "~5.8KB" in one place and "~6KB" in others. Pick one (see [stale] for 67/75).
- 42 [30][27] "No competitor offers this cleanly." -> "Orama needs a custom sorter for this, and the other candidates have no per-document boost."
- 44 [30][29][33] "explicitly states the JSON format was stabilized ... a few-hundred-LoC, one-time investment." -> "The MiniSearch CHANGELOG says the maintainer stabilized the JSON format \"to facilitate tools that create a serialized index in other languages.\"" Drop the port sentence (see [stale]).
- 46 [33] "Catches "openpai → openapi" (transposition), "petsore → PetStore", etc." -> "It matches \"openpai\" to \"openapi\" (a transposition) and \"petsore\" to \"PetStore\"."
- 48 [33][30][27] "**Smallest real full-text engine** at ~5.8KB gzipped, MIT, native TypeScript, actively maintained." -> "**Smallest full-text engine.** MiniSearch is about 5.8 KB gzipped, MIT-licensed, written in TypeScript, and maintained."
- 52 [15][13][10] "is query-ready immediately — no `addAll` pass, no spinner, no indexing latency regardless of site size." -> "`aid build` builds the index with MiniSearch and writes `ms.toJSON()` to a hashed `search-index.<hash>.js`. The browser calls `MiniSearch.loadJSON(...)` and can query at once, with no `addAll` pass at any site size."
- 84 [33] "Why .js wrapper instead of .json" -> "Why a .js wrapper instead of .json"
- 85 [33][accuracy] "V8 bytecode-caches `.js` after first load → zero parse cost on subsequent visits." -> "V8 caches the bytecode of a `.js` file after the first load, so later visits in Chromium browsers skip parsing." The original claims zero parse cost for all browsers, but only V8 does this.
- 86 [32][33] "Single network request, no `fetch().then(JSON.parse)` dance." -> "The index loads in one request without a `fetch().then(JSON.parse)` step."
- 87 [33] "Hashed filename for cache-busting on content changes." -> "The filename hash changes with the content, which busts caches."
- 91 [16][33][27] "**vs. ship raw doc JSON + index in browser**: no first-search indexing latency. For 5000-page sites, first-search delay drops from seconds to milliseconds." -> "**Indexing in the browser.** A precomputed index removes the indexing step before the first search. On a 5000-page site this should cut the first-search delay from seconds to milliseconds (estimate, not measured)."
- 92 [16][33] "**vs. roll our own search engine**: reuses MiniSearch's tested BM25 ... ~few-hundred-LoC emitter port instead of writing a search engine." -> "**Writing our own engine.** MiniSearch already has tested BM25 ranking, Levenshtein matching, prefix matching, and `boostDocument`." Drop the emitter clause (see [stale]).
- 93 [16][33] "**vs. Pagefind**: ... Hard fail for "openpai → openapi"." -> "**Pagefind.** Pagefind has no Levenshtein typo tolerance, so \"openpai\" does not find \"openapi\"."
- 96 [24][33] "risk is low but non-zero." -> see [stale]
- 100 [33] "(input + result dropdown as a partial), or just emit the index + runtime" -> see [stale]
- 101 [14][33] "Stemming language: MiniSearch has no built-in language packs; do we ship a snowball stemmer for English-only v1, or pluggable per-language?" -> "**Stemming.** MiniSearch has no language packs. Should v1 ship an English Snowball stemmer, or support a stemmer per language?" This question is still open; no stemmer exists in src.
- 102 [14][33] "Cache-busting strategy for `search-index.js`: filename hash + immutable HTTP header is standard; confirm fits the static-host deploy model." -> "The build already hashes the index filename. Confirm that common static hosts can send an immutable cache header for it."

### [stale]

- 12, 44, 50-54, 56-68 (fence), 90, 92, 96: "emitted ... by the aid binary (Go or Rust)", "Go or Rust port of the emitter", "Build pipeline (pure Go/Rust)", "vs. embed goja/boa ... aid binary stays pure Go/Rust" are all wrong. src/core/search-index.ts runs MiniSearch itself and writes `ms.toJSON()`. Cut bullet 90 entirely. Line 96's risk ("update the emitter once") no longer applies, because build and browser share the `minisearch` package. Rewrite it: "Build and browser use the same `minisearch` package, so a format change cannot split them."
- 96 "We pin a known-good MiniSearch runtime version per aid release": package.json has `"minisearch": "^7"`. That is not a pinned version, and it breaks the repo's own rule in .claude/rules/dependencies.md, which wants the caret of the resolved version.
- 65-67 (fence), 72-82 (fence): `search-index.js` and `minisearch.min.js` are wrong. The real file is `search-index.<hash>.js`, and MiniSearch loads through `import("minisearch")` inside the `aid-web.js` bundle (src/web/search.ts:97). No `<script src="minisearch.min.js">` exists. `fuzzy` comes from `search.typo_tolerance` and is not hard-coded to 0.2.
- 62-63 (fence): proto tokens are listed, but src/core/search-index.ts:44 excludes proto pages from the index.
- 100: Resolved. aid ships a default search UI in src/theme/components/SearchBox.tsx and src/web/search.ts.
- 102: Partly resolved. The filename hashing is implemented.

---

## Counts

| File | Findings (mechanical groups count once per line) |
|---|---|
| PRODUCT_OVERVIEW.md | about 165: 48 em-dash lines, 37 headings, 7 other ASCII, about 58 line findings, 18 [stale] |
| RESEARCH_stack.md | about 125: 32 em-dash lines, 14 other ASCII, 3 headings, 4 verdicts, about 62 line findings, 8 [stale] |
| RESEARCH_competitors.md | about 130: 26 em-dash lines, 16 other ASCII, 12 emoji rows, 13 headings, about 58 line findings, 6 [stale] |
| RESEARCH_search.md | about 60: 7 em-dash lines, 9 other ASCII, 7 headings, about 28 line findings, 6 [stale] |

## Sections to cut (rule 25/27)

- PRODUCT_OVERVIEW.md 471 and 475-483 (closing note and "Appendix: Future Iterations"): this is a generic "future work" list. It is already done or out of date (docs/BUILD.md, DEV_SERVER.md, HTML.md, LLMS_TXT.md, schemas/aid.schema.json; the language is chosen).
- PRODUCT_OVERVIEW.md 137, 263, 396, 404: each restates an earlier paragraph or table. Sections 3, 10 and 11 describe the same commands twice; merge them.
- RESEARCH_stack.md 182-184 ("On the user-memory note ..."): it argues with a private Claude memory file that readers of the repo cannot see.
- RESEARCH_stack.md 186-191, RESEARCH_competitors.md 115-122 and 134-139: these open questions and risks are all resolved. Replace each block with a one-line "Resolved: ..." note.
- RESEARCH_search.md line 90: it is about a Go/Rust binary that does not exist.

## Code bugs found during the check (outside the doc scope)

- src/core/search-index.ts:44 still leaves proto pages out of search, even though src/renderers/proto now produces `searchTokens`.
- src/search/emit.ts, src/search/tokenize.ts and src/search/runtime.ts are unused stubs that nothing imports. They look like dead code.
- package.json says `"minisearch": "^7"` and `"react": "^19"`. These break the "caret of the resolved version" rule in .claude/rules/dependencies.md.
- .claude/CLAUDE.md lists `bun run dev` and `bun run compile` scripts, which do not exist in package.json. It also describes `build` as "Bundle the browser-side runtime", but `build` runs scripts/compile.ts.