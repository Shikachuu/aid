# `aid build`

Builds the static documentation site to disk. Same code path the dev server uses internally.

## Command

```
aid build [dir] [--file aid.yaml] [--clean]
```

| Flag | Default | Role |
|---|---|---|
| `dir` (positional) | current directory | Project root (where `aid.yaml` lives). |
| `--file` / `-f` | `aid.yaml` | Config filename, relative to `dir`. |
| `--clean` | off | `rm -rf <outputDir>` before building. Use when stale files from a previous build need to go. |

Exit code is non-zero if the build throws (router collisions, asset clashes, frontmatter validation errors, etc.).

## Config

```yaml
# aid.yaml
name: "My Docs"
description: "..."
base_url: "https://docs.example.com"   # optional, used for absolute links
base_path: "/"                          # URL prefix; "/docs" hosts at example.com/docs/
stylesheet: "main.css"                  # Tailwind entrypoint relative to project root

dir:
  content:   "docs"     # source pages
  static:    "static"   # mirrored verbatim into output
  templates: ""         # partial overrides (empty = bundled defaults only)
  output:    "dist"     # build target
```

`<outputDir>` is always resolved relative to the project directory.

## Project layout

```
<projectDir>/
├── aid.yaml
├── main.css            # Tailwind entrypoint (default name; configurable)
├── docs/               # content (routes here)
│   ├── index.md        # → /
│   ├── api.yaml        # → /api (OpenAPI auto-detected)
│   ├── guides/
│   │   └── intro.md    # → /guides/intro
│   └── _drafts/        # _-prefixed: excluded from routing
├── static/             # → copied verbatim to <outputDir>/
└── templates/          # optional partial overrides
```

## Routing rules

- Scan `<contentDir>` for `**/*.{md,yaml,yml,json}`.
- `.md` → markdown route.
- `.yaml` / `.yml` / `.json` → content-sniffed; OpenAPI route iff the file has a top-level `openapi:` or `swagger:` key. Otherwise silently skipped (treated as a data file).
- Any path segment starting with `_` excludes the file (drafts, partials, includes).
- Two sources resolving to the same route path → hard error with both filenames.
- Route path = file path relative to content root, minus extension. `index.<ext>` collapses to its parent directory's route. Routes are sorted alphabetically.

## Output shape

For a route `/foo/bar`:

| File | Origin |
|---|---|
| `<outputDir>/foo/bar/index.html` | Rendered page in the site layout |
| `<outputDir>/foo/bar.md` | Sidechain export (markdown/HTML pages only) |
| `<outputDir>/foo/bar.json` | Sidechain export (OpenAPI/proto pages only) |

Plus, at the site root:

| File | Origin |
|---|---|
| `<outputDir>/index.html` | Root markdown page |
| `<outputDir>/main.<hash>.css` | Compiled, content-hashed Tailwind output |
| `<outputDir>/aid-web.<hash>.js` | Base browser runtime (always emitted) |
| `<outputDir>/aid-mermaid.<hash>.js` | Mermaid runtime (emitted only if any page uses mermaid) |
| `<outputDir>/aid-openapi.<hash>.js` + `.css` | Scalar runtime (emitted only if any OpenAPI page exists) |
| `<outputDir>/llms.txt` | LLM discovery file (see `LLMS_TXT.md`) |
| `<outputDir>/<static/**>` | Mirror of `<staticDir>` |
| `<outputDir>/<route>/<image>` | Colocated assets next to markdown sources |

All hashed filenames use xxh64 over their bytes — same content produces the same filename across runs.

## Pipeline phases

```
   ┌─ 1. buildRoutes  ──────────────────┐
   │                                     │
   └─ 1. copyStaticAssets ───────────────┤  (parallel)
                                         │
                                         ▼
                                ┌─ 2. dispatch renderers ─┐   (parallel per route)
                                │  markdown → renderMarkdown
                                │  openapi  → renderOpenApi
                                └────────────┬────────────┘
                                             ▼
                              3. buildWebBundle (gated on mermaid/openapi presence)
                                             ▼
                              4. wrapInLayout (per page, in memory)
                                             ▼
                              5. buildLlmsTxt
                                             ▼
                              6. compileTailwind (scans rendered HTML)
                                             ▼
                              7. writeCss (hashed filename)
                                             ▼
                              8. parallel writes: HTML pages, sidechain exports, llms.txt
                                             ▼
                                          done
```

### 1. Route discovery + static copy

`buildRoutes` walks `<contentDir>` (see "Routing rules"). `copyStaticAssets` mirrors `<staticDir>` into `<outputDir>` verbatim. Both run concurrently.

### 2. Renderers

Each route is rendered in parallel. Renderers produce a `RenderedPage` with:

- `html` — body HTML (no `<html>`/`<head>` chrome yet)
- `exports[]` — sidechain bodies (`.md` for prose pages, `.json` for specs)
- `searchTokens` — title + headings + body for the (eventually-emitted) search index
- `hasMermaid`, `hasOpenApi` — flags used to gate optional browser runtimes
- `description` — used for `<meta>` and `llms.txt`

**Markdown** (`renderMarkdown`): frontmatter is validated against a Zod schema (strict on known keys, `catchall(unknown)` for arbitrary user metadata). Body goes through unified/remark/rehype: GFM, slugged headings with anchor links, Mermaid fence rewriting, Shiki dual-theme syntax highlighting. Two outputs come off the same mdast — the rendered HTML and the `.md` sidechain — so colocated image URLs match across both.

**OpenAPI** (`renderOpenApi`): `.yaml`/`.yml`/`.json` parsed via Scalar's parser, normalized to OpenAPI 3.1, embedded as `<script type="application/json">` inside a page shell. The browser-side Scalar runtime picks it up at runtime; the same normalized JSON is emitted as the sidechain.

**Colocated assets** (markdown only): a relative `<img src="./x.svg">` in a markdown source copies `x.svg` next to the rendered page in the output, and rewrites the `<img src>` to the public absolute href. Colocated sources are sandboxed to `<contentDir>` — a `../escape.png` throws.

### 3. Browser runtime bundles

`buildWebBundle` emits up to three JS modules:

- `aid-web.<hash>.js` — base runtime (dark-mode toggle, AI button wiring, search-input lazy loader). Always emitted.
- `aid-mermaid.<hash>.js` — Mermaid renderer. Emitted only if at least one rendered page had a mermaid block.
- `aid-openapi.<hash>.js` + `.css` — Scalar runtime. Emitted only if at least one OpenAPI page exists.

Sites with no mermaid / no OpenAPI pay zero bytes for those runtimes.

### 4. Layout wrap

`wrapInLayout` runs the page body through the bundled `Layout` JSX component, injecting the page title (frontmatter `title` → first H1 → filename), description, stylesheet href placeholder, web bundle href, and the gated mermaid/openapi bundle hrefs. Each HTML doc holds a `__AID_STYLESHEET_HREF__` placeholder that gets substituted after the CSS is hashed.

### 5. llms.txt

`buildLlmsTxt` resolves the template (`<templatesDir>/llms.txt` if it exists, else bundled default), groups the rendered pages by their top-level directory, filters frontmatter-`llms: optional` pages into a separate section, and substitutes placeholders. See `LLMS_TXT.md` for details.

### 6. Tailwind compile

`compileTailwind` runs the embedded Tailwind 4 oxide compiler against `stylesheet` (the user's `main.css` entrypoint), with the rendered HTML strings handed in as `htmlContents`. This means Tailwind scans the **actual output** for utility classes — not source files — so any utility that survives JSX → HTML rendering is picked up, and unused ones are dropped.

The bundled aid theme (dark-mode token auto-derivation, default component styles) is exposed via `@import "aid/theme"` so user stylesheets opt in by importing it.

### 7. CSS write

`writeCss` hashes the compiled CSS (xxh64), writes `main.<hash>.css` to `<outputDir>`, and returns the public `href`. The hash means cache-busting is automatic.

### 8. Parallel writes

Every HTML page, every sidechain export, and `llms.txt` write in parallel. HTML writes substitute `__AID_STYLESHEET_HREF__` with the hashed CSS href at write time, so the file only hits disk once.

## Asset registry

Every write to `<outputDir>` is registered (by destination path) with an `AssetRegistry`. Two writers targeting the same path with different sources (e.g. a `static/logo.svg` and a colocated `docs/logo.svg`) throw with both source labels. Same source registering twice is a no-op (idempotent).

This catches:

- Static asset clashing with a route (`static/api.json` vs an OpenAPI route at `/api`)
- A `.md` sidechain colliding with a same-named asset
- Two pages each copying a different `logo.svg` to the same output directory

## Deployment

`<outputDir>` is a self-contained static bundle. Deploy to any HTTP host that serves files: S3, GitHub Pages, Cloudflare Pages, Netlify, nginx. aid has no deploy helper and no platform-specific output mode.

If `base_path` is non-`/`, the host must serve the output under that prefix (e.g. `aid build` with `base_path: "/docs"` → put `<outputDir>` behind `example.com/docs/`).

## Failure modes

| Trigger | Error |
|---|---|
| Two sources → same route | `aid: route collision — both "<a>" and "<b>" resolve to <path>` |
| Two writes → same output path | `aid: asset collision — both "<a>" and "<b>" target <path>` |
| Colocated image escapes `<contentDir>` | `aid: colocated asset "<x>" referenced from <page> escapes contentDir` |
| Invalid frontmatter | Zod-formatted error with the offending key |
| Unknown placeholder in `llms.txt` template | `aid: unknown llms.txt placeholder "{{<x>}}"` |

All failures surface as thrown errors with non-zero exit on the CLI.
