# `aid build`

`aid build` writes the static documentation site to disk. The dev server runs the same code path.

## Command

```
aid build [dir] [--file aid.yaml] [--clean]
```

| Flag | Default | Role |
| --- | --- | --- |
| `dir` (positional) | current directory | Project root (where `aid.yaml` lives). |
| `--file` / `-f` | `aid.yaml` | Config filename, relative to `dir`. |
| `--clean` | off | Runs `rm -rf <outputDir>` before building. Use it when a previous build left stale files. |

The command exits non-zero if the build throws, for example on a route collision, an asset collision, or a frontmatter validation error.

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
  templates: ""         # llms.txt template (empty = bundled default)
  output:    "dist"     # build target
```

aid resolves `<outputDir>` relative to the project directory.

## Project layout

```
<projectDir>/
├── aid.yaml
├── main.css            # Tailwind entrypoint (default name; configurable)
├── docs/               # content (routes here)
│   ├── index.md        # → /
│   ├── about.html      # → /about (full HTML document)
│   ├── api.yaml        # → /api (OpenAPI auto-detected)
│   ├── service.proto   # → /service
│   ├── guides/
│   │   └── intro.md    # → /guides/intro
│   └── _drafts/        # _-prefixed: excluded from routing
├── static/             # → copied verbatim to <outputDir>/
└── templates/          # optional llms.txt template
```

## Routing rules

- The router scans `<contentDir>` for `**/*.{md,html,yaml,yml,json,proto}`.
- A `.md` file becomes a markdown route.
- A `.html` file becomes an HTML route (see `HTML.md`).
- A `.proto` file becomes a proto route.
- aid sniffs the content of `.yaml`, `.yml`, and `.json` files. A file with a top-level `openapi:` or `swagger:` key becomes an OpenAPI route. aid skips any other such file without a warning and treats it as a data file.
- Any path segment starting with `_` excludes the file (drafts, partials, includes).
- If two sources resolve to the same route path, the build fails and the error names both files.
- The route path is the file path relative to the content root, without the extension. `index.<ext>` maps to its parent directory's route. The router sorts routes alphabetically.

## Output shape

For a route `/foo/bar`:

| File | Origin |
| --- | --- |
| `<outputDir>/foo/bar/index.html` | Rendered page in the site layout |
| `<outputDir>/foo/bar.md` | Sidechain export (markdown and HTML pages only) |
| `<outputDir>/foo/bar.json` | Sidechain export (OpenAPI pages only) |
| `<outputDir>/foo/bar.proto` | Sidechain export (proto pages only) |

aid also writes these files at the site root:

| File | Origin |
| --- | --- |
| `<outputDir>/index.html` | Root page |
| `<outputDir>/main.<hash>.css` | Compiled, content-hashed Tailwind output |
| `<outputDir>/aid-web.<hash>.js` | Base browser runtime (always emitted) |
| `<outputDir>/aid-mermaid.<hash>.js` | Mermaid runtime (emitted only if any page uses mermaid) |
| `<outputDir>/aid-openapi.<hash>.js` and `.css` | Scalar runtime (emitted only if any OpenAPI page exists) |
| `<outputDir>/aid-proto.<hash>.js` and `.css` | Proto UI runtime (emitted only if any proto page exists) |
| `<outputDir>/search-index.<hash>.js` | Search index (emitted when `search.enabled` is true, the default) |
| `<outputDir>/llms.txt` | LLM discovery file (see `LLMS_TXT.md`) |
| `<outputDir>/<static/**>` | Mirror of `<staticDir>` |
| `<outputDir>/<route>/<image>` | Colocated assets next to markdown and HTML sources |

All hashed filenames use xxh64 over their bytes, so the same content produces the same filename across runs.

## Pipeline phases

```
   ┌─ 1. buildRoutes  ──────────────────┐
   │                                     │
   └─ 1. copyStaticAssets ───────────────┤  (parallel)
                                         │
                                         ▼
                                ┌─ 2. dispatch renderers ─┐   (parallel per route)
                                │  markdown → renderMarkdown
                                │  html     → renderHtml
                                │  openapi  → renderOpenApi
                                │  proto    → renderProto
                                └────────────┬────────────┘
                                             ▼
                              3. buildWebBundle (gated on mermaid/openapi/proto presence)
                                             ▼
                              4. buildSearchIndex (skipped when search.enabled is false)
                                             ▼
                              5. wrapInLayout (per page, in memory)
                                             ▼
                              6. buildLlmsTxt
                                             ▼
                              7. compileTailwind (scans rendered HTML)
                                             ▼
                              8. writeCss (hashed filename)
                                             ▼
                              9. parallel writes: HTML pages, sidechain exports, llms.txt, search index
                                             ▼
                                          done
```

### 1. Route discovery and static copy

`buildRoutes` walks `<contentDir>` (see "Routing rules"). `copyStaticAssets` mirrors `<staticDir>` into `<outputDir>` as-is. The two run concurrently.

### 2. Renderers

The pipeline renders every route in parallel. Each renderer returns a `RenderedPage`:

- `html` is the body HTML, without the `<html>`/`<head>` chrome.
- `exports[]` holds the sidechain bodies: `.md` for markdown and HTML pages, `.json` for OpenAPI specs, and `.proto` for proto files.
- `searchTokens` holds the title, headings, and body for the search index.
- `hasMermaid`, `hasOpenApi`, and `hasProto` decide which optional browser runtimes a page loads.
- `description` is the one-line summary in `llms.txt`.

`renderMarkdown` validates frontmatter against a Zod schema (strict on known keys, `catchall(unknown)` for arbitrary user metadata). The body goes through unified, remark, and rehype: GFM, slugged headings with anchor links, Mermaid fence rewriting, and Shiki dual-theme syntax highlighting. The rendered HTML and the `.md` sidechain both come from the same mdast, so colocated image URLs match in both outputs.

`renderHtml` takes a full `.html` document, keeps its `<body>`, and converts that body into the `.md` sidechain. See `HTML.md`.

`renderOpenApi` parses `.yaml`, `.yml`, and `.json` specs with Scalar's parser, normalizes them to OpenAPI 3.1, and embeds the result as `<script type="application/json">` inside a page shell. The Scalar browser runtime reads that JSON on page load. aid also writes the same JSON as the sidechain.

`renderProto` parses the `.proto` file for the title, description, and search tokens, and writes a page shell with a mount point. The `aid-proto` browser runtime fetches the `.proto` sidechain and renders the UI. The sidechain is the unchanged `.proto` source.

Colocated assets work in markdown and HTML pages. A relative `<img src="./x.svg">` copies `x.svg` next to the rendered page in the output and rewrites the `<img src>` to the public absolute href. The pipeline restricts colocated sources to `<contentDir>`, so a `../escape.png` reference throws.

### 3. Browser runtime bundles

`buildWebBundle` emits up to four JS modules:

- `aid-web.<hash>.js` is the base runtime. It loads search on first focus and holds the hooks for the dark-mode toggle and the "Open in AI" button, which are not implemented yet. aid always emits it.
- `aid-mermaid.<hash>.js` is the Mermaid renderer. aid emits it only if at least one rendered page has a mermaid block.
- `aid-openapi.<hash>.js` and `.css` are the Scalar runtime. aid emits them only if at least one OpenAPI page exists.
- `aid-proto.<hash>.js` and `.css` are the proto UI runtime. aid emits them only if at least one proto page exists.

Sites without mermaid blocks, OpenAPI pages, or proto pages download none of those runtimes.

### 4. Search index

`buildSearchIndex` builds a MiniSearch index over the rendered pages and serializes it into `search-index.<hash>.js`. It returns `null` when `search.enabled` is false, and the Layout then omits the search box.

### 5. Layout wrap

`wrapInLayout` renders the page body inside the bundled `Layout` JSX component. It passes in the page title, the description, the stylesheet href placeholder, the web bundle href, the hrefs of the gated mermaid, OpenAPI, and proto bundles and stylesheets, and the search index settings. The title comes from frontmatter `title`, then the first H1, then the filename. Each HTML document holds a `__AID_STYLESHEET_HREF__` placeholder, which step 9 replaces with the hashed CSS href.

### 6. llms.txt

`buildLlmsTxt` uses `<templatesDir>/llms.txt` when it exists, else the bundled default. It groups the rendered pages by top-level directory and moves pages with frontmatter `llms: optional` into a separate section. Then it substitutes the placeholders. See `LLMS_TXT.md` for details.

### 7. Tailwind compile

`compileTailwind` runs the embedded Tailwind 4 oxide compiler against `stylesheet` (the user's `main.css` entrypoint) and passes the rendered HTML strings in as `htmlContents`. Tailwind scans the rendered output for utility classes, not the source files. It keeps every utility class that appears in the rendered HTML and drops the rest.

A user stylesheet opts into the bundled aid theme (dark-mode token auto-derivation, default component styles) with `@import "aid/theme"`.

### 8. CSS write

`writeCss` hashes the compiled CSS (xxh64), writes `main.<hash>.css` to `<outputDir>`, and returns the public `href`. The filename changes whenever the CSS changes, so browsers never serve a stale cached stylesheet.

### 9. Parallel writes

aid writes every HTML page, every sidechain export, `llms.txt`, and the search index in parallel. Each HTML write replaces `__AID_STYLESHEET_HREF__` with the hashed CSS href, so aid writes each page to disk once.

## Asset registry

The pipeline registers every write to `<outputDir>` with an `AssetRegistry`, keyed by destination path. If two writers target the same path with different sources (for example a `static/logo.svg` and a colocated `docs/logo.svg`), the registry throws and names both sources. Registering the same source twice is a no-op.

This catches:

- A static asset colliding with a route (`static/api.json` vs an OpenAPI route at `/api`)
- A `.md` sidechain colliding with a same-named asset
- Two pages each copying a different `logo.svg` to the same output directory

## Deployment

`<outputDir>` is a self-contained static bundle. Deploy it to any HTTP host that serves files: S3, GitHub Pages, Cloudflare Pages, Netlify, nginx. aid has no deploy helper and no platform-specific output mode.

If `base_path` is not `/`, the host must serve the output under that prefix. For example, with `base_path: "/docs"`, serve `<outputDir>` at `example.com/docs/`.

## Failure modes

| Trigger | Error |
| --- | --- |
| Two sources resolve to the same route | `aid: route collision — both "<a>" and "<b>" resolve to <path>` |
| Two writes target the same output path | `aid: asset collision — both "<a>" and "<b>" target <path>` |
| Colocated image escapes `<contentDir>` | `aid: colocated asset "<x>" referenced from <page> escapes contentDir` |
| Invalid frontmatter | Zod-formatted error with the offending key |
| Unknown placeholder in `llms.txt` template | `aid: unknown llms.txt placeholder "{{<x>}}"` |

Every failure throws, and the CLI exits non-zero.
