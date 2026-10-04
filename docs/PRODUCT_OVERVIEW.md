# aid (all-in-docs) product overview

## 1. Executive summary

aid is a single-binary documentation tool that generates static documentation sites. One CLI command turns markdown, HTML, OpenAPI specs, and Protocol Buffer definitions into a static site with one shared theme, machine-readable page exports, and an `llms.txt` file.

### Key differentiators

- **Single binary.** One executable contains the Tailwind CSS compiler, Biome, the linters and formatters, the API reference renderers, and a dev server. Users install nothing else. Release builds target macOS and Linux on x64 and arm64.
- **Colocated formats.** Markdown, HTML, OpenAPI (v2 and v3), and `.proto` files can share a directory. aid picks the renderer from the file type, and every page shares one layout.
- **LLM exports by default.** Markdown and HTML pages are available as markdown (`.md` suffix), OpenAPI pages as JSON (`.json` suffix), and proto pages as their `.proto` source. The build writes a spec-compliant `llms.txt` at the site root. Each page also has an "Open in AI" button, which is not wired up yet.
- **Convention over configuration.** A fixed folder layout and one `aid.yaml` are all a project needs, and only `name` is required.
- **Tailwind 4 theming with dark mode.** One `main.css` sets colors, fonts, and design tokens for every page type, including OpenAPI and proto pages. aid derives the dark palette from the light tokens.
- **Cross-format search.** Full-text, typo-tolerant search covers markdown, HTML, OpenAPI, and proto pages and ranks them in one list with per-format weights from `aid.yaml`. The build writes a precomputed index (`search-index.<hash>.js`), so the browser does not build one.

### Target use case

aid is for teams that publish API specs and proto definitions next to prose and do not want a separate tool for each format.

---

## 2. Core concepts

### Single binary

The `aid` executable embeds the Tailwind CSS 4 compiler, Biome, markdownlint, Spectral, Buf, the Scalar and proto reference UIs, and the dev server. Users install `aid` and nothing else.

### Convention over configuration

A project needs an `aid.yaml` with a `name`, a `main.css`, and a `docs/` content folder. Every other config field has a default. `aid init` will scaffold this layout from `assets/scaffold/`, but the command is not implemented yet.

### Multi-format, colocated

Any supported file type can be a page, and different types can share a directory. The route comes from the file path, and the file type picks the renderer:

- **Markdown** files render as HTML with GitHub Flavored Markdown, Mermaid diagrams, and SEO metadata from frontmatter.
- **HTML** files render as-is inside the site layout.
- **OpenAPI specs** (v2 and v3, YAML or JSON) render with the embedded Scalar API reference UI.
- **Proto files** render with aid's proto reference UI (`@aid/proto-ui`).

A single directory might contain `index.md`, `api.yaml`, and `events.proto`. Each becomes a route with its own renderer, and all three share the layout and styling.

### LLM-ready by default

aid generates machine-readable exports:

- Markdown and HTML pages are available as markdown by appending `.md` to the URL.
- OpenAPI pages are available as JSON by appending `.json` to the URL.
- Proto pages are available as their `.proto` source by appending `.proto` to the URL.
- The build writes `llms.txt` (per [llmstxt.org](https://llmstxt.org)) at the site root. It lists every page and tells LLMs how to fetch the machine-readable versions.

### Themeable with Tailwind 4

The bundled theme uses Tailwind CSS 4 and reads a `main.css` file where teams set colors, fonts, spacing, and other design tokens. Templates use Tailwind utility classes, so changing tokens restyles every page without editing templates.

Markdown pages, HTML pages, the OpenAPI reference UI, and the proto reference UI all read the same `main.css`. One set of color and typography tokens styles every page type.

**Dark mode is built in.** Define the light palette in `main.css` as `oklch()` colors, and aid derives a dark variant under `prefers-color-scheme: dark`. Override any token to set it by hand, or set `theme.dark_mode` to `manual` or `off`. The header has a dark-mode toggle button, but the toggle does nothing yet.

### Cross-format search

Markdown, HTML, OpenAPI, and proto pages share one search index. The build collects search tokens from each renderer, builds a MiniSearch index, and writes it as `search-index.<hash>.js`. The browser loads the precomputed index and queries it without building an index first.

It works as follows:

- Ranking is full-text BM25, not substring matching.
- Levenshtein typo tolerance. `openpai` finds `openapi`, and `petsore` finds `PetStore`.
- `aid.yaml` sets per-format weights, for example to rank OpenAPI pages above markdown pages.
- Results from all formats rank in one list. A query for `StreamEvent` can return the proto page that defines it, the OpenAPI page that returns it, and the markdown page that explains it.

---

## 3. CLI commands

| Command | Description |
| --------- | ------------- |
| `aid init` | Planned. Will create the required folder structure and an `aid.yaml`. It currently prints "not implemented" and exits with code 1. |
| `aid dev` | Starts a local dev server with live reload. |
| `aid build` | Builds the static site into the configured output directory. |
| `aid lint` | Runs the bundled linters over markdown, OpenAPI, proto, CSS, JSON, and JavaScript or TypeScript files. |
| `aid fmt` | Runs the bundled formatters over the same file types. |

### `aid dev`

`aid dev` serves the site locally and reloads the browser after changes. It does the following:

- Starts an HTTP server on the configured host and port (default `localhost:3000`).
- Watches content files, templates, styles, the files Tailwind reports as dependencies, and `aid.yaml`.
- Rebuilds the site into two alternating directories on disk, `.aid/dev/build-a` and `.aid/dev/build-b`, using the same pipeline as `aid build`.
- Reloads the browser over Server-Sent Events after each rebuild.

See docs/DEV_SERVER.md for details.

### `aid build`

`aid build` compiles the site into a directory of static files. The output contains:

- HTML pages for every routed content file.
- The compiled, hashed stylesheet (`main.<hash>.css`).
- The browser bundles (`aid-web.js`, plus `aid-mermaid.js`, `aid-openapi.js`, and `aid-proto.js` when the site needs them).
- The contents of the static directory (images, fonts, and similar files).
- Markdown exports (`.md`) for markdown and HTML pages, JSON exports (`.json`) for OpenAPI pages, and `.proto` exports for proto pages.
- `llms.txt` at the site root.
- `search-index.<hash>.js`, the precomputed search index.

aid stops at writing static files. Any static host can serve the output directory, for example S3, GitHub Pages, Netlify, Cloudflare Pages, or nginx. aid has no deploy command. See docs/BUILD.md for details.

### `aid lint` and `aid fmt`

`aid lint` and `aid fmt` run the embedded tools over the project. Biome handles CSS, JSON, and JavaScript or TypeScript files, markdownlint handles markdown, Spectral lints OpenAPI files, and Buf handles `.proto` files. aid finds OpenAPI files for linting by name: `openapi.yaml`, `*.openapi.yaml`, or any YAML or JSON file under an `openapi/` folder.

---

## 4. Project structure and routing

### 4.1 Required folder structure

A typical project looks like this:

```
my-docs/
├── aid.yaml                # Project configuration
├── main.css                # Tailwind 4 entry point (the default `stylesheet`)
├── docs/                   # Content root (all files here become routes)
│   ├── index.md            # Landing page -> /
│   ├── getting-started/
│   │   └── index.md        # -> /getting-started
│   ├── products/
│   │   ├── index.html      # -> /products/ (HTML page)
│   │   ├── api.yaml        # -> /products/api (OpenAPI spec, rendered with API reference UI)
│   │   ├── stocks.md       # -> /products/stocks (Markdown page)
│   │   └── events.proto    # -> /products/events (Proto file, rendered with proto docs UI)
│   └── _drafts/            # _ prefix: excluded from routing
│       └── roadmap.md
├── static/                 # (optional) Copied as-is to output (images, fonts, favicon)
└── templates/              # (optional) Template overrides, for example llms.txt
```

The bundled scaffold in `assets/scaffold/` has only `aid.yaml`, `main.css`, and `docs/index.md`.

### 4.2 Folder-based routing model

Every supported file in the content root becomes a route. The route is the file path relative to the content root, with the file extension stripped and the configured `base_path` prepended. File types can share any directory, because routing uses only the path. The examples below assume the default `base_path: "/"`:

| File path | Route | Rendered as |
| ----------- | ------- | ------------- |
| `docs/index.md` | `/` | Markdown page |
| `docs/products/index.html` | `/products/` | HTML page |
| `docs/products/stocks.md` | `/products/stocks` | Markdown page |
| `docs/products/api.yaml` | `/products/api` | OpenAPI reference UI |
| `docs/products/events.proto` | `/products/events` | Proto documentation UI |

aid treats a `.yaml`, `.yml`, or `.json` file as OpenAPI only if it has a top-level `openapi` or `swagger` key, and skips it otherwise. If two files resolve to the same route, the build fails.

The router skips any path that has a `_`-prefixed segment. Use these folders for:

- Draft content not ready for publishing
- Shared assets or data files
- Any files that should exist in the project but not generate standalone pages

aid has no versioning feature. Users can keep versions in folders (`docs/v1/`, `docs/v2/`), and aid routes them like any other folder.

### 4.3 File type to page rendering

| Source file type | Rendering | Auto-exported formats |
| ----------------- | ----------- | ---------------------- |
| `.md` (Markdown) | GitHub Flavored Markdown with Mermaid diagrams. aid reads SEO metadata (title, description) from frontmatter. | `.md` (original source) |
| `.html` | Inserted as-is into the site layout template. | `.md` |
| `.yaml` / `.json` (OpenAPI v2-v3) | Embedded Scalar API reference UI (`@scalar/api-reference`). | `.json` |
| `.proto` (Protocol Buffers) | `@aid/proto-ui` (React and protobufjs), rendered in the browser. | `.proto` (original source) |

aid wraps every page in the site layout template, so every page has the same header, footer, and styling. The layout has a navigation sidebar, but the build passes it an empty tree for now, so it renders no links.

---

## 5. Configuration (`aid.yaml`)

The project configuration lives in one YAML file at the project root. The schema is in `src/core/config.ts`, and `bun run emit-schema` generates `schemas/aid.schema.json` from it.

### Schema overview

```yaml
# Project metadata
name: "My Documentation"
description: "Documentation for the Acme platform"
version: "1.0.0"
base_url: "https://docs.example.com"
base_path: "/docs"           # URL base path prefix (default: "/", e.g. "/docs" for example.com/docs/...)

# Stylesheet
stylesheet: "main.css"       # Path to the Tailwind CSS entry point (applied to all page types)

# Directories
dir:
  content: "docs"            # Content root (default: "docs")
  output: "dist"             # Build output directory (default: "dist")
  templates: ""              # Directory of template overrides (optional, empty = use bundled defaults)
  static: "static"           # Copied verbatim into the build output (default: "static")

# Theming
theme:
  dark_mode: "auto"          # "auto" derives the dark palette from light tokens; "manual" expects you to define dark variants in main.css; "off" disables dark mode entirely

# AI integrations
ai_targets:                  # "Open in AI" targets (default: chatgpt, claude). Not read by the build yet.
  - chatgpt
  - claude

# Cross-format search
search:
  enabled: true              # generate the cross-format search index at build time (default: true)
  typo_tolerance: 0.2        # fraction of term length allowed as edit distance (0.2 = up to 1 edit per 5 chars)
  weights:                   # per-format ranking boosts applied at query time
    markdown: 1.0
    html: 1.0
    openapi: 2.0             # boost OpenAPI hits over prose
    proto: 1.5

# Dev server
dev:
  port: 3000                 # Dev server port (default: 3000)
  host: "localhost"          # Dev server host (default: "localhost")
```

Every field except `name` has a default, so the smallest valid config sets only `name`.

---

## 6. Template system

### 6.1 Bundled templates

aid ships default templates as TSX components in `src/theme/components/`, rendered to HTML at build time by aid's own JSX runtime (`src/jsx-runtime.ts`). There is a template for each page type:

- `PageMarkdown` renders the parsed markdown inside the site layout.
- `PageHtml` wraps the HTML body inside the site layout.
- `PageOpenAPI` embeds the Scalar API reference UI with the spec loaded.
- `PageProto` renders a mount point that the proto UI fills in the browser.
- `PageIndex` is meant for directory listings. The build does not use it yet.

`Layout`, `Header`, `Nav`, `Footer`, `SearchBox`, `AIButton`, and `DarkToggle` make up the shared page frame. All templates use Tailwind 4 utility classes and read their theme from `main.css` through CSS custom properties.

### 6.2 Theming-first customization

Most teams only edit `main.css`. Its Tailwind 4 tokens (colors, fonts, spacing, radii) style every page type, and aid derives the dark palette from the same tokens.

Template overrides are planned but not implemented. The plan is that a `.tsx` file with a partial's name in the templates directory replaces that partial, and aid falls back to the bundled default for every other partial. `resolvePartial` in `src/theme/partials.ts` is still a stub that always returns the bundled default. The one override that works today is `llms.txt`. A `llms.txt` file in the templates directory replaces the bundled `llms.txt` template.

Templates can use:

- Tailwind 4 utility classes, including dark-mode variants
- CSS custom properties defined in `main.css`
- Template data: page content, metadata, navigation tree, and site config

---

## 7. LLM integration

aid has three LLM features: a discovery file (`llms.txt`), per-page machine-readable exports, and a planned "Open in AI" button on every page.

### 7.1 `llms.txt`

The build writes `llms.txt` at the site root, following the [llmstxt.org](https://llmstxt.org) spec. It contains:

- A table of contents that lists every page, grouped by top-level folder.
- Instructions for fetching each page in another format:
  - Append `.md` to markdown and HTML page URLs for a markdown version.
  - Append `.json` to OpenAPI page URLs for the spec as JSON.
  - Append `.proto` to proto page URLs for the source file.

A `llms.txt` file in the templates directory replaces the bundled template. It can use the `{{name}}`, `{{description}}`, `{{base_url}}`, `{{toc}}`, and `{{toc:optional}}` placeholders. See docs/LLMS_TXT.md.

### 7.2 Auto-exported page formats

| Page type | `.md` export | `.json` export | `.proto` export |
|-----------|:------------:|:--------------:|:---------------:|
| Markdown  | Yes          | No             | No              |
| HTML      | Yes          | No             | No              |
| OpenAPI   | No           | Yes            | No              |
| Proto     | No           | No             | Yes             |

### 7.3 "Open in AI" button

The "Open in AI" button is a stub. Every page type renders one "Open in AI" button that carries the page's machine-readable URL, but clicking it does nothing. `buildAiButtons` in `src/core/ai-targets.ts` returns an empty list, and the click handler in `src/web/ai-button.ts` is empty.

The plan is that clicking the button opens the configured chat (ChatGPT, Claude, or Gemini) with a prompt that points at the page's machine-readable version. The `ai_targets` key in `aid.yaml` will choose the targets:

```yaml
ai_targets:
  - chatgpt
  - claude
  - gemini
```

aid will pass the page through each target's "open with prompt" URL, so the button will need no API key or backend.

---

## 8. Cross-format search

Search runs in the browser. One index covers markdown, HTML, OpenAPI, and proto pages and ranks them with per-format weights from `aid.yaml`.

### 8.1 Architecture

The build writes a precomputed search index as `search-index.<hash>.js`. The browser loads it and queries it without an indexing pass.

```
aid build
  └─ renders every route; each renderer returns search tokens
  └─ builds one MiniSearch index (new MiniSearch, addAll), one document per page
  └─ writes dist/search-index.<hash>.js, which assigns ms.toJSON() to
     window.__AID_SEARCH__
  └─ bundles the MiniSearch runtime into aid-web.js through import("minisearch")

Browser (lazy on first focus of the search box):
  └─ <script src="search-index.<hash>.js">
  └─ import("minisearch")
  └─ MiniSearch.loadJSON(JSON.stringify(window.__AID_SEARCH__), options)
  └─ ms.search(query, { fuzzy, prefix, boostDocument })
```

aid runs MiniSearch itself at build time, in TypeScript on Bun, and writes the result of `toJSON()`. The browser uses the same `minisearch` package, so the index format cannot drift between build and query. The browser gets MiniSearch's BM25 ranking, Levenshtein matching, and `boostDocument` API.

### 8.2 Per-format weights

By default, OpenAPI pages (weight 2.0) and proto pages (1.5) rank above markdown and HTML pages (1.0). A query for `getPets` should land on the API spec, not on the tutorial that mentions it. `aid.yaml` sets the weights:

```yaml
search:
  weights:
    markdown: 1.0
    html: 1.0
    openapi: 2.0
    proto: 1.5
```

The index has one document per page, and each weight applies to every page of that type. The browser applies the weights through MiniSearch's `boostDocument` at query time. The build writes the weights into each page's HTML (the `data-aid-search-weights` attribute), so changing them needs a rebuild.

### 8.3 Typo tolerance

Search is fuzzy by default. `search.typo_tolerance` sets the allowed edit distance as a fraction of term length. The default `0.2` allows one edit per five characters. For example:

- `openpai` matches `openapi`
- `petsore` matches `PetStore`
- `StreamEvnt` matches `StreamEvent`

Prefix matching is on, so `open` already matches `openapi`.

### 8.4 What gets indexed

| Source         | Indexed fields                                                            |
|----------------|---------------------------------------------------------------------------|
| Markdown       | Title (boosted 3x), headings (boosted 2x), body text                      |
| HTML           | Title (boosted 3x), body                                                  |
| OpenAPI        | Title, `operationId`s, paths, schema names, parameter names, summaries    |
| Proto          | Title, message, enum, service, RPC, and field names, comments             |

Each result stores `type` (used for per-format weighting), `title`, and `url`.

### 8.5 Output files

The build writes one search file at the site root, `search-index.<hash>.js`. It holds the precomputed index as a script that assigns `window.__AID_SEARCH__`. The hash in the filename changes with the content, which busts caches. The MiniSearch runtime is part of the `aid-web.js` bundle.

The browser loads the index on the first focus of the search box, so users who never search do not download it.

---

## 9. Bundled tooling

aid has no external runtime dependencies. `bun build --compile` packs the Bun runtime, aid's code, and its npm dependencies into one executable. aid embeds the native files that cannot be bundled as JavaScript once per target.

### Tooling inventory

| Tool | Purpose | Bundling strategy |
| ------ | --------- | ------------------- |
| Tailwind CSS 4 compiler | Processes `main.css` and generates the final stylesheet | `@tailwindcss/node` and `@tailwindcss/oxide`, called in-process. The lightningcss native file is embedded per target. |
| Biome | Linting and formatting for CSS, JSON, and JavaScript or TypeScript | `@biomejs/js-api` over the WASM build |
| markdownlint | Lint and format `.md` files | npm library (`markdownlint`) |
| Spectral | Lint OpenAPI files | npm libraries (`@stoplight/spectral-*`) |
| OpenAPI formatter | Canonicalize OpenAPI files | `Bun.YAML` or JSON round trip. It drops YAML comments. |
| Buf | Lint and format `.proto` files | `@bufbuild/buf` native binary, embedded per target |
| Markdown renderer | GFM parsing and syntax highlighting | unified, remark, rehype, and Shiki. Mermaid renders in the browser. |
| OpenAPI reference UI | Interactive API documentation | Scalar (`@scalar/api-reference`), bundled as `aid-openapi.js` |
| Proto documentation UI | Interactive proto documentation viewer | `@aid/proto-ui` (React and protobufjs), bundled as `aid-proto.js` |
| MiniSearch runtime | In-browser query engine for the precomputed search index | Bundled into `aid-web.js` |

### Bundling strategy

aid embeds only the Buf binary and the lightningcss native file per target (see `scripts/compile.ts`). Each release binary carries the natives for its own platform. The release targets are `darwin-arm64`, `darwin-x64`, `linux-arm64`, and `linux-x64`. Windows is not supported.

Users install no other tools, and every user runs the same tool versions.

---

## 10. Architecture overview

### High-level data flow

```
Source Files (md, html, yaml, json, proto)
        │
        ▼
   ┌─────────┐
   │ Router  │  <- Walks the content root, classifies files, skips _ folders
   └────┬────┘
        │
        ▼
  ┌───────────┐
  │ Renderers │  <- Per format: markdown (unified), HTML, OpenAPI (Scalar), proto
  └─────┬─────┘
        │
        ▼
  ┌───────────┐
  │ Templates │  <- TSX components rendered by aid's JSX runtime: layout + page templates
  └─────┬─────┘
        │
        ▼
  ┌───────────┐
  │ Tailwind  │  <- Scans the rendered HTML, compiles main.css into main.<hash>.css
  └─────┬─────┘
        │
        ▼
  ┌───────────┐
  │  Output   │  <- HTML + CSS + JS bundles + static files + .md/.json/.proto exports + llms.txt + search index
  └───────────┘
```

Each renderer also returns search tokens. The search index builder collects them into one MiniSearch index and writes it next to the other output files.

### Component map

| Component | Responsibility |
| ----------- | --------------- |
| CLI | Command parsing (citty), dispatching to subsystems (`src/cli`) |
| Config loader | Reads `aid.yaml` with `Bun.YAML` and validates it with Zod (`src/core/config.ts`) |
| Router | Walks the content directory, builds the route list, excludes `_` folders (`src/core/router.ts`) |
| Renderers | Format-specific rendering: GFM with Mermaid, HTML passthrough, OpenAPI, proto (`src/renderers`) |
| Templates | TSX components (`src/theme/components`). Partial overrides are planned; `src/theme/partials.ts` is a stub. |
| Tailwind pipeline | Runs the embedded Tailwind compiler against `main.css` and derives the dark-mode palette from light tokens (`src/core/tailwind.ts`, `src/core/dark-mode.ts`) |
| Export generator | Writes the `.md`, `.json`, and `.proto` exports and generates `llms.txt` (`src/core/pipeline.ts`, `src/core/llms-txt.ts`) |
| Search index builder | Builds the MiniSearch index from each page's search tokens and writes `search-index.<hash>.js` (`src/core/search-index.ts`) |
| AI link builder | Planned. Will generate per-page "Open in AI" URLs for ChatGPT, Claude, and Gemini. `src/core/ai-targets.ts` is a stub. |
| Dev server | HTTP server, file watcher, and live reload over Server-Sent Events (`src/dev`) |
| Linter and formatter | Runs the embedded tools: Biome, markdownlint, Spectral, Buf (`src/lint`, `src/fmt`) |
