# aid (all-in-docs) — Product Overview

## 1. Executive Summary

**aid** is a single-binary documentation tool that generates static documentation sites with zero external dependencies. It takes markdown, HTML, OpenAPI specs, and Protocol Buffer definitions and produces a cohesive, themed documentation site — complete with an LLM-friendly layer — using one CLI command.

### Key Differentiators

- **Single binary, zero dependencies** — one statically-linked executable contains everything: Tailwind CSS compiler, Biome, linters, formatters, API reference renderers, and a dev server. Nothing else to install.
- **Multi-format, colocated** — markdown, HTML, OpenAPI (v2 through v3), and `.proto` files can live side by side in any directory. Each is rendered with the appropriate UI based on file type, producing a cohesive site with consistent styling and navigation.
- **LLM-ready by default** — markdown and HTML pages are available as markdown (`.md` suffix), OpenAPI/proto pages export as JSON (`.json` suffix), and a spec-compliant `llms.txt` file is generated at the site root. Every page also ships an **"Open in AI" button** that hands the current page straight into ChatGPT, Claude, or other LLM chat interfaces in one click.
- **Convention over configuration** — a required folder structure and a single YAML config file (`aid.yaml`) get you from zero to docs site in seconds.
- **Themeable via Tailwind 4, dark mode included** — the bundled framework exposes a `main.css` for custom Tailwind 4 configuration (colors, fonts, design tokens). Theming applies uniformly across all page types — including OpenAPI and proto renderers — for a consistent look and feel. Dark mode ships built-in, with a contrast-correct palette auto-derived from your light tokens.
- **Cross-format search, instant on load** — full-text, typo-tolerant search across markdown, HTML, OpenAPI, and proto pages, ranked together with per-format weights you control. The build emits a precomputed search index as a static `search-index.js`, so the browser is query-ready the moment it loads — no client-side indexing pass.

### Target Use Case

Teams and organizations that need a documentation site supporting technical formats (API specs, proto definitions) alongside prose — without managing a dozen tools, plugins, or build pipelines.

---

## 2. Core Concepts

### Single Binary, Batteries Included

Everything ships inside one executable. The Tailwind CSS 4 compiler, Biome (for CSS/HTML/JSON linting and formatting), markdown tooling, OpenAPI/proto linters and formatters, API reference UIs, and a development server are all embedded. Users install `aid` and nothing else.

### Convention Over Configuration

Running `aid init` scaffolds a project with a required folder structure and an `aid.yaml` config file pre-filled with basic project info. This convention means projects are immediately buildable — configuration is optional, not mandatory.

### Multi-Format, Colocated

aid treats every supported file type as a first-class page source. Different file types can coexist in the same directory — routing is purely path-based, and each file is rendered with the UI appropriate to its type:

- **Markdown** files render as rich HTML with GitHub Flavored Markdown, Mermaid diagram support, and frontmatter-driven SEO metadata.
- **HTML** files render as-is within the site layout.
- **OpenAPI specs** (v2 through v3, YAML or JSON) render with an embedded API reference UI.
- **Proto files** render with an embedded protocol buffer documentation UI.

A single directory might contain `index.md`, `api.yaml`, and `events.proto` — all become sibling routes under the same path, each with the right renderer. All pages share the same templates, navigation, and styling.

### LLM-Ready by Default

aid automatically generates machine-readable exports:

- Markdown and HTML pages are available as plain markdown by appending `.md` to the URL.
- OpenAPI and proto pages export structured JSON by appending `.json` to the URL.
- A spec-compliant `llms.txt` file (per [llmstxt.org](https://llmstxt.org)) is generated at the site root, providing LLMs with a table of contents and instructions for navigating the documentation programmatically.

### Themeable via Tailwind 4

The bundled documentation framework uses Tailwind CSS 4 and exposes a `main.css` file where teams can configure custom colors, fonts, spacing, and other design tokens. Templates use Tailwind utility classes, making the entire look and feel customizable without touching the template structure.

Crucially, theming is unified across **all renderers** — markdown pages, HTML pages, OpenAPI reference UIs, and proto documentation UIs all consume the same `main.css`. This means a single set of color and typography definitions produces a consistent look across every page type.

**Dark mode is built-in.** Define your light palette in `main.css` and aid auto-derives a contrast-correct dark variant; override any token if you need pixel control. The toggle, `prefers-color-scheme` handling, and dark styles for OpenAPI and proto pages all ship with the framework — no plugin, no extra config.

### Cross-Format Search

Every page — markdown, HTML, OpenAPI operation, proto message — is part of one searchable corpus. The build pipeline tokenizes content from each format, builds a unified inverted index, and emits it as a precomputed `search-index.js`. The browser loads the script and queries it instantly — no in-browser indexing pass.

Key behaviors:

- Full-text BM25-style ranking, not substring matching.
- Levenshtein typo tolerance — `openpai` still finds `openapi`, `petsore` finds `PetStore`.
- Per-format weights configurable in `aid.yaml`: boost OpenAPI operation IDs over markdown body text, or proto messages over HTML, etc.
- Cross-format results — a query for `StreamEvent` returns the proto message that defines it, the OpenAPI operation that returns it, and the markdown page that explains it, all ranked together.

---

## 3. CLI Commands

| Command | Description |
|---------|-------------|
| `aid init` | Scaffold a new project: creates the required folder structure and an `aid.yaml` config with basic project info. |
| `aid dev` | Start a local development server with hot reload. Watches for changes in content, templates, and styles. |
| `aid build` | Build the complete static site to the configured output directory. |
| `aid lint` | Run bundled linters across all supported formats: markdown, OpenAPI, proto, CSS, and HTML. |
| `aid fmt` | Run bundled formatters across all supported formats: markdown, OpenAPI, proto, CSS, and HTML. |

### `aid init`

Creates a new documentation project in the current directory (or a specified path). Generates the required folder structure and a pre-filled `aid.yaml`. The scaffolded project is immediately buildable with `aid build` or servable with `aid dev`.

### `aid dev`

Starts a built-in HTTP server that serves the documentation site locally. Watches for changes to content files, templates, styles, and configuration — and triggers hot reload in the browser automatically.

### `aid build`

Compiles the entire documentation site into a directory of static files (HTML, CSS, assets, `.md` exports for markdown/HTML pages, `.json` exports for OpenAPI/proto pages, `llms.txt`). The output is ready to deploy to any static hosting provider.

### `aid lint` / `aid fmt`

Runs the bundled linting and formatting tools against all supported file types in the project. Both commands operate across markdown, OpenAPI specs, proto files, CSS, and HTML — using the embedded toolchain with no external dependencies.

---

## 4. Project Structure & Routing

### 4.1 Required Folder Structure

Running `aid init` produces the following canonical structure:

```
my-docs/
├── aid.yaml                # Project configuration
├── docs/                   # Content root (all files here become routes)
│   ├── index.md            # Landing page → /
│   ├── getting-started/
│   │   └── index.md        # → /getting-started
│   ├── products/
│   │   ├── index.html      # → /products/ (HTML page)
│   │   ├── api.yaml        # → /products/api (OpenAPI spec, rendered with API reference UI)
│   │   ├── stocks.md       # → /products/stocks (Markdown page)
│   │   └── events.proto    # → /products/events (Proto file, rendered with proto docs UI)
│   └── _partials/          # _ prefix: excluded from routing, usable as includes
│       ├── header.html
│       └── footer.html
├── static/                 # Static assets (images, fonts, etc.) — copied as-is to output
└── templates/              # (optional) Named partial overrides — drop in only the partials you want to replace
```

### 4.2 Folder-Based Routing Model

Every file in the content root becomes a route. The route is derived from the file path relative to the content root, with the file extension stripped and the configured `base_path` prepended. **File types can be freely mixed within any directory** — routing is purely path-based, not type-based. Examples below assume the default `base_path: "/"` :

| File path | Route | Rendered as |
|-----------|-------|-------------|
| `docs/index.md` | `/` | Markdown page |
| `docs/products/index.html` | `/products/` | HTML page |
| `docs/products/stocks.md` | `/products/stocks` | Markdown page |
| `docs/products/api.yaml` | `/products/api` | OpenAPI reference UI |
| `docs/products/events.proto` | `/products/events` | Proto documentation UI |

This colocation model means a single directory can contain prose documentation, API specs, and proto definitions side by side — each rendered with the appropriate UI based on its file type.

**`_`-prefixed folders** are excluded from the route tree entirely. They can contain:
- Shared HTML fragments or partials that templates can include
- Draft content not ready for publishing
- Shared assets or data files used during rendering
- Any files that should exist in the project but not generate standalone pages

**Versioning-aware design**: the folder structure is intentionally flexible enough for users to organize by version (e.g., `docs/v1/...`, `docs/v2/...`) without aid enforcing a specific versioning pattern. aid routes whatever folder structure it finds — version boundaries are a user-level convention, not a framework constraint.

### 4.3 File Type to Page Rendering

| Source file type | Rendering | Auto-exported formats |
|-----------------|-----------|----------------------|
| `.md` (Markdown) | GitHub Flavored Markdown + Mermaid diagrams. Frontmatter parsed for SEO metadata (title, description, etc.). | `.md` (original source) |
| `.html` | Rendered as-is within the site layout template. | `.md` |
| `.yaml` / `.json` (OpenAPI v2–v3) | Embedded API reference UI (e.g., Scalar, Swagger UI, or Redoc). | `.json` |
| `.proto` (Protocol Buffers) | Embedded protocol buffer documentation UI. | `.json` |

Every page, regardless of source format, is wrapped in the site layout template and receives consistent navigation, header, footer, and styling.

---

## 5. Configuration (`aid.yaml`)

The project configuration lives in a single YAML file at the project root. Running `aid init` generates it with sensible defaults.

### Schema Overview

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
  templates: ""              # Directory of named partial overrides (optional, empty = use bundled defaults)

# Theming
theme:
  dark_mode: "auto"          # "auto" derives the dark palette from light tokens; "manual" expects you to define dark variants in main.css; "off" disables dark mode entirely

# AI integrations
ai_targets:                  # "Open in AI" buttons rendered on every page (omit or empty list to disable)
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

All fields have defaults — the minimal valid config only requires `name`.

---

## 6. Template System

### 6.1 Bundled Templates

aid ships with a complete set of default templates. The template engine is TBD (e.g., Go `html/template`, Tera, Handlebars — depends on the implementation language chosen). There is a template for each page type:

- **Markdown page** — renders the parsed markdown content within the site layout
- **HTML page** — wraps raw HTML content in the site layout
- **OpenAPI page** — embeds the API reference UI with the spec loaded
- **Proto page** — embeds the proto documentation UI with the definition loaded
- **Index / listing pages** — renders directory listings and navigation

All templates use Tailwind 4 utility classes and reference `main.css` for theming via CSS custom properties.

### 6.2 Theming-First Customization

Most teams should never need to touch templates — `main.css` is the primary customization surface. By configuring Tailwind 4 design tokens (colors, fonts, spacing, radii) there, every page type — markdown, HTML, OpenAPI reference, proto docs — picks up the same look without per-template work. Dark mode is derived automatically from those same tokens, so a single light palette produces a coherent dark counterpart across every renderer.

When templates *do* need overriding, drop a named partial into the `templates/` directory and aid uses it transparently. There is no "eject everything" step: aid resolves each partial by name at render time, falling back to the bundled default whenever no override exists. You can override the OpenAPI page layout *or* the navigation header — without touching, copying, or maintaining any unrelated partials.

Templates have full access to:
- Tailwind 4 utility classes (including dark-mode variants)
- CSS custom properties defined in `main.css`
- Template data (page content, metadata, navigation tree, site config)

---

## 7. LLM Integration

aid treats LLMs as a first-class consumer of the documentation. Three mechanisms ship by default: a structured discovery file (`llms.txt`), per-page machine-readable exports, and an "Open in AI" button on every page.

### 7.1 `llms.txt`

aid automatically generates an `llms.txt` file at the site root, following the [llmstxt.org](https://llmstxt.org) specification. This file provides LLMs with a structured way to discover and consume the documentation.

**What it contains:**

- **Table of contents** — a structured listing of every page in the documentation site
- **Format instructions** — how to access different representations of each page:
  - Append `.md` to markdown/HTML page URLs for a plain markdown version
  - Append `.json` to OpenAPI/proto page URLs for structured data

### 7.2 Auto-Exported Page Formats

| Page type | `.md` export | `.json` export |
|-----------|:------------:|:--------------:|
| Markdown  | Yes          | No             |
| HTML      | Yes          | No             |
| OpenAPI   | No           | Yes            |
| Proto     | No           | Yes            |

Markdown and HTML pages are consumable by LLMs as plain markdown. OpenAPI and proto pages are available as structured JSON for programmatic use.

### 7.3 "Open in AI" Button

Every rendered page includes an **Open in AI** button in the page chrome. Clicking it hands the current page (its `.md` or `.json` representation, depending on type) to a configurable LLM chat interface — ChatGPT, Claude, Gemini, and others — pre-seeded with a sensible prompt ("explain this page", "answer questions about this API", etc.).

The set of available targets is configured in `aid.yaml`:

```yaml
ai_targets:
  - chatgpt
  - claude
  - gemini
```

aid renders one button per target (or a single dropdown if multiple are configured). The page's content is passed via each target's documented "open with prompt" URL pattern, so no API keys, accounts, or backend integrations are required — the click takes the user straight into their preferred LLM with the page already in context.

---

## 8. Cross-Format Search

aid's search is **frontend-only, instant on load, typo-tolerant, and aware of every supported file type**. Markdown prose, HTML pages, OpenAPI operations, and proto messages are all part of the same searchable corpus, ranked together with per-format weights you control.

### 8.1 Architecture

The build emits a precomputed search index as a static `search-index.js` file. The browser loads it and queries it instantly — no client-side indexing pass, no `addAll` loop, no spinner.

```
aid build
  └─ walks content tree
  └─ tokenizes each file according to its format
  └─ constructs an inverted index in pure Go/Rust
  └─ emits dist/search-index.js — a self-bootstrapping module exposing
     window.__AID_SEARCH__ as a MiniSearch-format JSON literal
  └─ ships dist/minisearch.min.js (~6KB gz) as the runtime

Browser (lazy on first focus of the search box):
  └─ <script src="search-index.js">         // V8-bytecode-cached after first load
  └─ <script src="minisearch.min.js">
  └─ MiniSearch.loadJSON(window.__AID_SEARCH__, options)   // instant
  └─ ms.search(query, { fuzzy, prefix, boostDocument })
```

The aid binary writes MiniSearch's documented index format **directly from Go/Rust** — no embedded JavaScript runtime is required at build time. This keeps the binary pure and avoids a goja/V8 dependency, while reusing MiniSearch's tested BM25 ranking, Levenshtein matching, and `boostDocument` API in the browser.

### 8.2 Per-Format Weights

Different file types yield different ranking signal. By default, OpenAPI operation IDs and proto message names are boosted over prose body text — a query for `getPets` should land on the API definition, not on the tutorial that mentions it. Weights are configurable in `aid.yaml`:

```yaml
search:
  weights:
    markdown: 1.0
    html: 1.0
    openapi: 2.0
    proto: 1.5
```

Per-document weighting is applied via MiniSearch's `boostDocument` callback at query time, so weight changes only require a config update — no rebuild.

### 8.3 Typo Tolerance

Search is fuzzy by default. Configurable as a fraction of term length (default `0.2` = up to 1 edit per 5 characters):

- `openpai` → matches `openapi`
- `petsore` → matches `PetStore`
- `StreamEvnt` → matches `StreamEvent`

Prefix matching is also enabled, so partial typing (`open` → `openapi`) returns useful results before the full term is typed.

### 8.4 What Gets Indexed

| Source         | Indexed fields                                                            |
|----------------|---------------------------------------------------------------------------|
| Markdown       | Frontmatter title, headings (boosted), body text                          |
| HTML           | `<title>`, `<h1>`–`<h6>` (boosted), visible text                          |
| OpenAPI        | `operationId`, summary, description, path, schema names, parameter names  |
| Proto          | message names, field names, RPC names, leading/trailing comments          |

Stored fields per result include `type` (used for per-format weighting), `title`, `url`, and a snippet for highlighting.

### 8.5 Output Files

Two artifacts are produced at the site root:

- `search-index.js` — the precomputed index as a self-bootstrapping JS module. Hashed filename for cache-busting.
- `minisearch.min.js` — the MiniSearch runtime (~6KB gzipped).

Both are loaded lazily on first focus of the search box, so users who never search pay no bandwidth or CPU cost.

---

## 9. Bundled Tooling

One of aid's core principles is **zero external dependencies**. Every tool in the pipeline is either compiled directly into the binary or embedded as bytes and executed at runtime.

### Tooling Inventory

| Tool | Purpose | Bundling Strategy |
|------|---------|-------------------|
| **Tailwind CSS 4 compiler** | Processes `main.css` and generates the final stylesheet | Embedded binary, executed at build/dev time |
| **Biome** | Linting + formatting for CSS, HTML, and JSON files | Embedded binary |
| **Markdown linter/formatter** | Lint and format `.md` files | Embedded binary or compiled-in library (TBD) |
| **OpenAPI linter/formatter** | Lint and format OpenAPI spec files | Embedded binary or compiled-in library (TBD) |
| **Proto linter/formatter** | Lint and format `.proto` files | Embedded binary (TBD) |
| **Markdown renderer** | GFM parsing + Mermaid diagram rendering | Compiled in as a library |
| **OpenAPI reference UI** | Interactive API documentation (e.g., Scalar, Swagger UI, Redoc) | Bundled static assets |
| **Proto documentation UI** | Interactive proto documentation viewer | Bundled static assets |
| **MiniSearch runtime** | In-browser query engine for the precomputed cross-format search index | Bundled static asset (`minisearch.min.js`, ~6KB gz) |

### Bundling Strategy

All external binaries (Tailwind, Biome, format-specific linters) are included as byte arrays in the final aid executable. At runtime, they are extracted to a temporary location and executed as needed. This approach:

- Eliminates the need for users to install any external tools
- Ensures consistent tool versions across all environments
- Keeps the distribution story simple: one binary, one download

---

## 10. Dev Server

### `aid dev`

The built-in development server provides a local preview environment with hot reload capabilities.

**Key behaviors:**
- Starts an HTTP server on the configured port (default: `localhost:3000`)
- Watches for changes in content files, templates, styles, and configuration
- Triggers automatic browser reload when changes are detected
- Serves the same output as `aid build`, but generated in-memory for speed
- Runs the Tailwind compiler in watch mode to pick up style changes instantly

The dev server is designed for fast iteration — change a markdown file, save, and see the result immediately.

---

## 11. Build and Output

### `aid build`

Compiles the entire documentation site into a directory of static files.

**Output contents:**
- HTML pages for every routed content file
- Compiled CSS (Tailwind output)
- Static assets (images, fonts, etc.)
- Markdown exports (`.md`) for markdown and HTML pages
- JSON exports (`.json`) for OpenAPI and proto pages
- `llms.txt` at the site root
- `search-index.js` (precomputed cross-format search index) and `minisearch.min.js` (runtime)

**Deployment:** aid's responsibility ends at generating static files. The output directory can be deployed to any static hosting provider — S3, GitHub Pages, Netlify, Cloudflare Pages, nginx, or any HTTP server capable of serving files. No deployment helpers or platform-specific integrations are included.

---

## 12. Architecture Overview

### High-Level Data Flow

```
Source Files (md, html, yaml, proto)
        │
        ▼
   ┌─────────┐
   │  Parser  │  ← Detects file type, extracts metadata/frontmatter
   └────┬─────┘
        │
        ▼
  ┌───────────┐
  │ Renderers │  ← Format-specific: GFM renderer, OpenAPI UI, Proto UI
  └─────┬─────┘
        │
        ▼
  ┌───────────┐
  │ Templates │  ← Template engine (TBD): layout + page-type templates
  └─────┬─────┘
        │
        ▼
  ┌───────────┐
  │ Tailwind  │  ← Compiles main.css → final stylesheet
  └─────┬─────┘
        │
        ▼
  ┌───────────┐
  │  Output   │  ← HTML + CSS + assets + .md/.json exports + llms.txt + search-index.js
  └───────────┘
```

The parser also feeds a parallel **search index builder** that tokenizes every page (markdown headings/body, OpenAPI operations/schemas, proto messages/RPCs) into a unified inverted index, emitted alongside the rest of the output as a precomputed `search-index.js` in MiniSearch's documented JSON format.

### Component Map

| Component | Responsibility |
|-----------|---------------|
| **CLI** | Command parsing, dispatching to subsystems |
| **Config loader** | Reads and validates `aid.yaml` |
| **Router** | Walks content directory, builds route tree, excludes `_` folders |
| **Parsers** | File-type detection, frontmatter extraction, metadata parsing |
| **Renderers** | Format-specific rendering (GFM+Mermaid, OpenAPI UI, Proto UI, HTML passthrough) |
| **Template engine** | Template engine (TBD) with named-partial override resolution (user partials → bundled fallback) |
| **Tailwind pipeline** | Runs the embedded Tailwind compiler against `main.css`; auto-derives the dark-mode palette from light tokens |
| **Export generator** | Produces `.md` and `.json` variants, generates `llms.txt` |
| **Search index builder** | Tokenizes every page (md / OpenAPI / proto / HTML), builds the inverted index in pure Go/Rust, emits `search-index.js` in MiniSearch's documented format |
| **AI link builder** | Generates per-page "Open in AI" URLs for each configured target (ChatGPT, Claude, Gemini, …) |
| **Dev server** | HTTP server + file watcher + hot reload |
| **Linter/Formatter** | Orchestrates embedded tools (Biome, markdown/OpenAPI/proto linters) |

*Detailed architecture diagrams and subsystem breakdowns will be added in future iterations of this document.*

---

## Appendix: Future Iterations

This document is the **first layer** of the technical overview. Subsequent passes will add:

1. **Architecture diagrams** — Mermaid-based component and data flow diagrams
2. **Subsystem deep-dives** — detailed breakdown of each component (routing engine, template resolution, Tailwind pipeline, file watcher, export generator)
3. **Config schema reference** — full YAML specification with all fields, types, defaults, and validation rules
4. **Decision records** — architectural decision records (ADRs) for key choices: implementation language, bundling strategy, renderer selection, template engine, linter/formatter tooling
5. **Edge cases and error handling** — how aid behaves with malformed input, missing files, conflicting routes, invalid config
