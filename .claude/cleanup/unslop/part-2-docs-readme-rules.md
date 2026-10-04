# Unslop cleanup: part 2 (BUILD, LLMS_TXT, DEV_SERVER, HTML, README, assets, fixtures, help.ts, .claude)

## docs/BUILD.md

- `3` [33] "Same code path the dev server uses internally." -> "The dev server runs the same code path."
- `15` [33][32] "`rm -rf <outputDir>` before building. Use when stale files from a previous build need to go." -> "Runs `rm -rf <outputDir>` before building. Use it when a previous build left stale files."
- `17` [11] "(router collisions, asset clashes, frontmatter validation errors, etc.)" -> "The command exits non-zero if the build throws, for example on a route collision, an asset collision, or a frontmatter validation error." (The error strings say "route collision" and "asset collision".)
- `36` [29] "`<outputDir>` is always resolved relative to the project directory." -> "aid resolves `<outputDir>` relative to the project directory."
- `56` [stale] "Scan `<contentDir>` for `**/*.{md,yaml,yml,json}`." -> The router glob is `**/*.{md,html,yaml,yml,json,proto}` (src/core/router.ts:13). Rewrite: "The router scans `<contentDir>` for `**/*.{md,html,yaml,yml,json,proto}`."
- `57` [33][ASCII] "`.md` → markdown route." -> "A `.md` file becomes a markdown route."
- `57` [stale] The list leaves out two route kinds. Add "A `.html` file becomes an HTML route (see `HTML.md`)." and "A `.proto` file becomes a proto route."
- `58` [33][29][ASCII] "`.yaml` / `.yml` / `.json` → content-sniffed; OpenAPI route iff the file has a top-level `openapi:` or `swagger:` key. Otherwise silently skipped (treated as a data file)." -> "aid sniffs the content of `.yaml`, `.yml`, and `.json` files. A file with a top-level `openapi:` or `swagger:` key becomes an OpenAPI route. aid skips any other such file without a warning and treats it as a data file."
- `60` [33][ASCII] "Two sources resolving to the same route path → hard error with both filenames." -> "If two sources resolve to the same route path, the build fails and the error names both files."
- `61` [33][29] "Route path = file path relative to content root, minus extension. ... Routes are sorted alphabetically." -> "The route path is the file path relative to the content root, without the extension. `index.<ext>` maps to its parent directory's route. The router sorts routes alphabetically."
- `41-52` [stale] (fenced; fix only the facts) The layout tree has no `.html` or `.proto` example. It also labels `templates/` "optional partial overrides", but `resolvePartial` is a stub that always returns the bundled default (src/theme/partials.ts). The same "partial overrides" claim is in the line 32 yaml comment.
- `71` [stale] "`<outputDir>/foo/bar.json` | Sidechain export (OpenAPI/proto pages only)" -> Proto pages export `.proto`, not `.json` (src/renderers/proto/index.ts:46). Split it into two rows: "`<outputDir>/foo/bar.json` | Sidechain export (OpenAPI pages only)" and "`<outputDir>/foo/bar.proto` | Sidechain export (proto pages only)".
- `73` [33] "Plus, at the site root:" -> "aid also writes these files at the site root:"
- `77-84` [stale] The table has no rows for `aid-proto.<hash>.js` + `.css` (emitted only if a proto page exists) or `search-index.<hash>.js` (emitted when `search.enabled`). Both appear in src/core/web-bundle.ts:126-136 and src/core/search-index.ts:57.
- `86` [13] "over their bytes — same content produces the same filename across runs." -> "over their bytes, so the same content produces the same filename across runs."
- `90-114` [stale] (fenced diagram) It has no `renderHtml` or `renderProto` branch and no `buildSearchIndex` step (pipeline.ts:46). Step 3 should read "gated on mermaid/openapi/proto presence". Step 8 should also list the search index.
- `116` [33] "### 1. Route discovery + static copy" -> "### 1. Route discovery and static copy"
- `122` [29] "Each route is rendered in parallel." -> "The pipeline renders every route in parallel."
- `124-128` [13] Each item has the "`field` — description" em-dash pattern. Rewrite each as a sentence, for example "`html` is the body HTML, without the `<html>`/`<head>` chrome." and "`exports[]` holds the sidechain bodies."
- `126` [33][stale] "`searchTokens` — title + headings + body for the (eventually-emitted) search index" -> "`searchTokens` holds the title, headings, and body for the search index." The pipeline emits the index now.
- `127` [stale] "`hasMermaid`, `hasOpenApi` — flags used to gate optional browser runtimes" -> "`hasMermaid`, `hasOpenApi`, and `hasProto` decide which optional browser runtimes a page loads."
- `128` [stale] "`description` — used for `<meta>` and `llms.txt`" -> `wrapInLayout` reads `<meta>` from `route.frontmatter.description`, not from `RenderedPage.description` (pipeline.ts:173). OpenAPI and proto descriptions only reach `llms.txt`. Rewrite: "`description` is the one-line summary in `llms.txt`."
- `130` [29][13][32] "frontmatter is validated against a Zod schema ... Two outputs come off the same mdast — the rendered HTML and the `.md` sidechain — so colocated image URLs match across both." -> "`renderMarkdown` validates frontmatter against a Zod schema (...). ... The rendered HTML and the `.md` sidechain both come from the same mdast, so colocated image URLs match in both outputs."
- `130-134` [stale] The section describes only the markdown and OpenAPI renderers. Add `renderHtml` (see `HTML.md`). Add `renderProto`, which writes a hydration shell, uses the `.proto` source as its sidechain, and loads `aid-proto`.
- `132` [33][29] "`.yaml`/`.yml`/`.json` parsed via Scalar's parser, normalized to OpenAPI 3.1, embedded as ... The browser-side Scalar runtime picks it up at runtime; the same normalized JSON is emitted as the sidechain." -> "`renderOpenApi` parses `.yaml`, `.yml`, and `.json` specs with Scalar's parser, normalizes them to OpenAPI 3.1, and embeds the result as `<script type="application/json">` inside a page shell. The Scalar browser runtime reads that JSON on page load. aid also writes the same JSON as the sidechain."
- `134` [stale] "**Colocated assets** (markdown only)" -> HTML pages also copy colocated assets (pipeline.ts:106). Change it to "(markdown and HTML)".
- `134` [13][29] "Colocated sources are sandboxed to `<contentDir>` — a `../escape.png` throws." -> "The pipeline restricts colocated sources to `<contentDir>`, so a `../escape.png` reference throws."
- `138` [stale] "`buildWebBundle` emits up to three JS modules:" -> "up to four JS modules" (add `aid-proto.<hash>.js` + `.css`, emitted only if a proto page exists).
- `140-142` [13] Same em-dash definition pattern. Rewrite as sentences: "`aid-web.<hash>.js` is the base runtime (...). aid always emits it."
- `144` [32][stale] "Sites with no mermaid / no OpenAPI pay zero bytes for those runtimes." -> "Sites without mermaid blocks, OpenAPI pages, or proto pages download none of those runtimes."
- `148` [3][28][33][ASCII] "runs the page body through the bundled `Layout` JSX component, injecting the page title (frontmatter `title` → first H1 → filename), ... that gets substituted after the CSS is hashed." -> "`wrapInLayout` renders the page body inside the bundled `Layout` JSX component. It passes in the page title, the description, the stylesheet href placeholder, the web bundle href, and the hrefs of the gated bundles. The title comes from frontmatter `title`, then the first H1, then the filename. Each HTML document holds a `__AID_STYLESHEET_HREF__` placeholder, which step 8 replaces with the hashed CSS href."
- `148` [stale] The description leaves out the proto bundle and stylesheet hrefs and the search index props (pipeline.ts:184-204).
- `152` [28] One sentence carries four clauses. -> "`buildLlmsTxt` uses `<templatesDir>/llms.txt` when it exists, else the bundled default. It groups the rendered pages by top-level directory and moves pages with frontmatter `llms: optional` into a separate section. Then it substitutes the placeholders."
- `156` [23][13][15][29][32][ASCII] "This means Tailwind scans the **actual output** for utility classes — not source files — so any utility that survives JSX → HTML rendering is picked up, and unused ones are dropped." -> "Tailwind scans the rendered output for utility classes, not the source files. It keeps every utility class that appears in the rendered HTML and drops the rest."
- `158` [29] "The bundled aid theme (...) is exposed via `@import "aid/theme"` so user stylesheets opt in by importing it." -> "A user stylesheet opts into the bundled aid theme (...) with `@import "aid/theme"`."
- `162` [27] "The hash means cache-busting is automatic." -> "The filename changes whenever the CSS changes, so browsers never serve a stale cached stylesheet."
- `166` [stale][32] "Every HTML page, every sidechain export, and `llms.txt` write in parallel. HTML writes substitute ... so the file only hits disk once." -> "aid writes every HTML page, every sidechain export, `llms.txt`, and the search index in parallel. Each HTML write replaces `__AID_STYLESHEET_HREF__` with the hashed CSS href, so aid writes each page to disk once."
- `170` [29][33] "Every write to `<outputDir>` is registered (by destination path) with an `AssetRegistry`. ... Same source registering twice is a no-op (idempotent)." -> "The pipeline registers every write to `<outputDir>` with an `AssetRegistry`, keyed by destination path. ... Registering the same source twice is a no-op."
- `174` [11] "Static asset clashing with a route" -> "A static asset colliding with a route"
- `182` [33][ASCII] "(e.g. `aid build` with `base_path: "/docs"` → put `<outputDir>` behind `example.com/docs/`)" -> "For example, with `base_path: "/docs"`, serve `<outputDir>` at `example.com/docs/`."
- `188-189` [33][ASCII] "Two sources → same route", "Two writes → same output path" -> "Two sources resolve to the same route", "Two writes target the same output path". Leave the quoted error strings unchanged; their em dashes come from the code.
- `194` [33] "All failures surface as thrown errors with non-zero exit on the CLI." -> "Every failure throws, and the CLI exits non-zero."

## docs/LLMS_TXT.md

- `3` [27] "The prose is yours; the routing is auto-generated." -> "You write the prose in a template, and aid generates the table of contents."
- `9` [15] "**Optional** template. If present, aid uses it verbatim and only substitutes placeholders." -> "Optional template. If it exists, aid uses it as-is and substitutes only the placeholders."
- `10` [33][32] "Always emitted (bundled default kicks in when no template exists)." -> "aid always writes it and uses the bundled default when no template exists."
- `12` [13] "The default is `""` (no template directory) — drop a path there to activate the override." -> "The default is `""`, which means no template directory. Set it to a directory path to enable the override."
- `26` [13][33] "Only existing top-level fields feed the generator — no `llms_txt` block today." -> "The generator reads only existing top-level fields. There is no `llms_txt` config block."
- `32` [33][ASCII] "Empty → path-only. `{{base_url}}`" -> "When unset, bullets use path-only URLs. Also available as `{{base_url}}`."
- `32,46,47,71,82` [33] The abbreviation "TOC" is never spelled out. Write "table of contents (TOC)" at its first use on line 32.
- `39` [29][33] "Substituted by a tiny `{{name}}` / `{{name:arg}}` engine. Unknown placeholders fail the build with the offending name in the message." -> "aid substitutes placeholders of the form `{{name}}` and `{{name:arg}}`. An unknown placeholder fails the build, and the error names it."
- `46` [15][stale] "every **non-optional** page (see "Grouping" below)" -> "every page not marked optional (see "TOC behavior" below)". No section is titled "Grouping".
- `47` [13][15] "**no `## Optional` heading** — write that yourself in the template" -> "Flat bullet list of pages marked optional. It has no `## Optional` heading, so write that heading in the template yourself."
- `49` [33] "There is no conditional / loop syntax." -> "The engine has no conditional or loop syntax."
- `60` [stale] (fenced default template) The real default says "Append `.md` to a markdown route, `.json` to an OpenAPI route, or `.proto` to a Proto route" (src/core/llms-txt.ts:9).
- `69` [27] "Override the template if that bothers you." -> "Override the template to remove the empty heading."
- `73,77,78,79,80` [16] The bullets use the bold-label-colon form ("**Grouping**: ...", "**Order**: ..."). Convert them to prose, or use the period form "**Grouping.** ...".
- `74-75` [33][ASCII] "`docs/index.md`, `docs/api.yaml` → grouped under `## Docs` (root-level files)." -> "Root-level files such as `docs/index.md` and `docs/api.yaml` go under `## Docs`." Line 75 becomes "`docs/guides/intro.md` goes under `## Guides`." Line 76 follows the same pattern.
- `77` [29][33] "`Docs` is pinned first; all other groups alphabetical. Inside each group, bullets are sorted by route path." -> "`Docs` comes first, and the other groups follow in alphabetical order. aid sorts the bullets in each group by route path."
- `78` [13][29] "— the `: description` suffix is omitted when none exists." -> "aid omits the `: description` suffix when the page has no description."
- `80` [stale] "markdown frontmatter `description`, or OpenAPI `info.description`. Proto: none today." -> Proto pages use the first paragraph of the package leading comment (src/renderers/proto/index.ts:31). HTML pages use `<meta name="description">`. Rewrite: "Markdown frontmatter `description`, HTML `<meta name="description">`, OpenAPI `info.description`, or the first paragraph of a proto file's package comment."
- `84` [15] "the **machine-readable** variant" -> "the machine-readable variant"
- `91` [stale] "`.proto` | `.json`" -> "`.proto` | `.proto`" (machineUrlFor, llms-txt.ts:87).
- `93` [30] "to match the file aid actually writes" -> "to match the file aid writes"
- `103` [ASCII] "`/docs/api.json`, …)" -> "`/docs/api.json`, and so on)"
- `107` [32] "so it ships in `{{toc:optional}}`" -> "so it appears in `{{toc:optional}}`"
- `118` [11] "in v1" -> The other docs say "v0", "v0.1", and "v1" for the same release. Pick one label for all four docs.
- `139` [13] "already contains `## Docs`, `## Guides`, etc. — don't wrap it in another H2." -> "The generated `{{toc}}` block already has its own H2 headings (`## Docs`, `## Guides`, and so on), so do not wrap it in another H2."

## docs/DEV_SERVER.md

- `3` [33] "Local dev server with hot reload. Runs the same build pipeline..." -> "`aid dev` runs a local dev server with hot reload. It runs the same build pipeline..."
- `14` [33] "(use for `.yml` or alt configs)" -> "(use it for `.yml` or other config filenames)"
- `14,42` [stale] The watcher hard-codes `<cwd>/aid.yaml` (src/dev/watcher.ts:31). With `--file aid.yml`, config edits neither trigger the restart message nor exit. This is a code bug the doc hides; fix the code or document the limitation.
- `15` [ASCII][33] "Integer 0–65535." -> "An integer from 0 to 65535."
- `18` [32] "CLI flags win over config; config wins over defaults." -> "CLI flags override the config file, and the config file overrides the defaults."
- `31` [33][ASCII][29] "makes the server redirect `/` → `/docs/`; everything below the prefix is served, everything above 404s." -> "With `base_path: "/docs"`, the server redirects `/` to `/docs/`, serves every path under the prefix, and returns 404 for every other path."
- `35` [29] "Everything the build pipeline reads from is watched recursively:" -> "The watcher recursively watches every input of the build pipeline:"
- `42` [15][13] "**process exits** — restart `aid dev` to pick up the new config" -> "The process exits. Restart `aid dev` to load the new config."
- `45` [29][32][28] "Anything under `.aid/` is filtered out so aid's own writes can't loop back into the watcher. Watcher events are batched on a 100ms debounce; files whose `mtimeMs` hasn't advanced are dropped (works around macOS emitting read events)." -> "The watcher ignores everything under `.aid/`, so aid's own writes do not trigger rebuilds. It batches events in a 100ms debounce window. It drops files whose `mtimeMs` has not changed, because macOS emits events on reads."
- `49` [29][stale] "the other one is being written to. Readers never see a half-written `dist/`." -> "the next build writes to the other one. Readers never see a half-written build." Dev builds go to `.aid/dev/build-*`, not `dist/`.
- `50` [33] "(the current one plus one trailing)" -> "(the running build and one more)"
- `51` [13][33][29] "Output goes to disk — same code path as `aid build`. Per-build durations are logged: `[aid] rebuilt in 217ms`." -> "Each build writes to disk through the same code path as `aid build`. The server logs each build's duration, for example `[aid] rebuilt in 217ms`."
- `55` [33] "a small SSE client" -> "a small server-sent events (SSE) client" (spell the abbreviation out at first use).
- `59` [13][29] "`location.reload()` — fired after every successful rebuild." -> "Calls `location.reload()`. The server sends it after every successful rebuild."
- `61` [29] "(fired alongside the next successful rebuild)" -> "(sent with the next successful rebuild)"
- `63` [33] "No browser plugin needed." -> "You do not need a browser plugin."
- `67` [32] "the current buffer keeps serving (last successful output stays live)" -> "the server keeps serving the last successful build"
- `69` [13][15] "When the **first** build (before any buffer is live) fails, ... hosts the overlay — there is no prior site to fall back to." -> "If the first build fails, there is no earlier build to serve. Every non-SSE request then returns a minimal HTML page that shows the overlay."
- `82` [29][33] "`.aid/` is created on first run and ignored from git via the auto-written `.gitignore`. Safe to delete between sessions." -> "`aid dev` creates `.aid/` on first run and writes a `.gitignore` inside it that excludes the directory from git. You can delete `.aid/` between sessions."
- `91` [33][ASCII] "Loop: change → debounce → rebuild → flip buffer → broadcast `reload`." -> "On each change, debounce, rebuild, swap the live buffer, and broadcast `reload`."
- `92` [33][ASCII] "SIGINT / SIGTERM → stop the watcher and the server, exit 0." -> "On SIGINT or SIGTERM, stop the watcher and the server and exit with code 0."
- `94` [14] "If `aid.yaml` changes mid-session: the server broadcasts..." -> "If `aid.yaml` changes during a session, the server broadcasts an error frame that tells the user to restart, then exits with code 0."
- `98` [13][33][ASCII] "No WebSocket — SSE only. Fine for one-way server→browser notifications; no client→server channel." -> "The server uses SSE, not WebSocket. SSE carries notifications from server to browser only, and there is no channel from browser to server."
- `101` [13] "binds to `localhost` by default — don't expose it..." -> "...binds to `localhost` by default. Do not expose it to a public network without a reverse proxy."

## docs/HTML.md

- `3` [13][27] "Drop full `.html` files into `<contentDir>` and aid renders them as first-class pages — wrapped in the same Layout..." -> "aid renders every full `.html` file in `<contentDir>` as a page. It wraps each one in the same Layout that markdown and OpenAPI pages use, with the same theming, dark mode, navigation, and AI-button toolbar."
- `3` [stale] (unverified at runtime) "navigation": `wrapInLayout` passes `nav: []` for every page (pipeline.ts:196), so no page gets navigation yet.
- `24` [27] "the build fails with the source path and a clear error." -> "the build fails, and the error names the source path."
- `28` [13][29] "`<head>` is dropped — aid's Layout owns `<html>`, `<head>`, and the document chrome. Two tags are read first and promoted onto the page:" -> "aid drops `<head>`, because its Layout renders `<html>`, `<head>`, and the document chrome. Before it drops `<head>`, aid copies two tags onto the page:"
- `35` [29][ASCII] "Empty `<title></title>` is treated as absent. ... (`about.html` → `about`)." -> "aid treats an empty `<title></title>` as missing. ... (`about.html` becomes `about`)."
- `37` [29][23][15] "Other `<head>` content (...) is currently discarded. See **Out of scope** below." -> "aid discards all other `<head>` content (...). See "Out of scope" below."
- `41` [13][33] "Same routing model as markdown — extension stripped, path-based." -> "HTML pages follow the markdown routing model. aid strips the extension and derives the route from the file path."
- `49` [29][15][32] "The `.md` sidechain is produced by converting the body subtree through `rehype-remark` + `remark-stringify`. Colocated image hrefs are rewritten **once** (before the HTML/MD branches fork), so..." -> "aid produces the `.md` sidechain by converting the body subtree with `rehype-remark` and `remark-stringify`. aid rewrites colocated image hrefs once, before it builds the HTML and `.md` outputs, so both outputs reference the same public URL."
- `53` [29][13] "Relative `<img src>` values pointing at files next to the HTML source are copied into the route's output directory and rewritten to public hrefs — same rules as markdown's `![alt](./hero.png)`." -> "aid copies each file that a relative `<img src>` points at into the route's output directory and rewrites the src to a public href. Markdown's `![alt](./hero.png)` follows the same rules."
- `58` [29][33] "resolved relative to the source dir" -> "aid resolves it relative to the source directory"
- `62` [13] "is a hard error — same boundary check the markdown renderer applies." -> "fails the build. The markdown renderer applies the same boundary check."
- `66` [29][13] "so the lazy mermaid bundle gets injected into the page. The block content is preserved verbatim — the client-side mermaid runtime renders it..." -> "and the Layout injects the lazy mermaid bundle into the page. aid keeps the block content as-is. The mermaid runtime in the browser renders it the same way it renders a fenced ```` ```mermaid ```` block from a markdown source."
- `80` [13][33] "Same — fails the sniff." -> "The build fails, because the file has neither tag."
- `82` [33] "Non-fatal vfile warning; src left untouched in both HTML and `.md` outputs." -> "aid records a non-fatal vfile warning and leaves the src unchanged in both outputs."
- `86` [13][32] "The full-document requirement is intentional — it makes the metadata source unambiguous and keeps the parser path single-mode." -> "The full-document requirement is deliberate. Metadata always comes from `<head>`, and the parser handles one input shape."
- `87` [29] "Author-supplied `<script>` / `<link>` / extra `<meta>` tags are dropped." -> "aid drops author-supplied `<script>`, `<link>`, and extra `<meta>` tags."
- `88` [29][26][32][stale] "are read by the browser but not promoted onto the page record. Layout will grow these surfaces later." -> The browser never sees these tags, because aid drops `<head>`. Rewrite: "aid drops Open Graph, Twitter Card, robots, and other `<meta>` tags. Layout support for them is planned."
- `89` [29][33][32][stale] "Headings are not yet extracted ... the array is left empty. Will land alongside the cross-format search builder." -> The search builder already exists (src/core/search-index.ts) and indexes HTML pages. Rewrite: "The HTML renderer does not extract headings into `searchTokens.headings`, so search matches HTML pages on title and body only."
- `7,84,86` [11] The version labels "v0.1" here, "v0" in DEV_SERVER.md, and "v1" in LLMS_TXT.md disagree. Pick one.

## README.md

- `3` The line is a blockquote, so I left it unchanged. It says "Protocol Buffers", while the other docs say "Protobuf" or "proto".
- `5` [33][27] "Generates a cohesive, themed documentation site from your existing content with one CLI command." -> "aid generates one themed documentation site from your existing content with a single CLI command."
- `5` [stale] "Markdown and OpenAPI specs and `.proto` files coexist in the same folder tree." -> "Markdown, HTML, OpenAPI specs, and `.proto` files live in the same folder tree."
- `5` [26][32][stale] "An LLM-ready layer (`llms.txt`, per-page `.md` and `.json` exports, an "Open in AI" button) ships by default." -> "By default, every build writes `llms.txt`, a per-page `.md`, `.json`, or `.proto` export, and an "Open in AI" button."
- `5` [27][29][stale] "Cross-format search is precomputed at build time and instant in the browser." -> "The build precomputes a search index over markdown, HTML, and OpenAPI pages, and the browser queries it without a server." Proto pages are excluded from the index (search-index.ts:44).
- `9` [33][26][stale] "Early scaffold. Not yet usable." -> "`aid build` and `aid dev` work. `aid init` is not implemented yet." (`aid lint` and `aid fmt` have code too; I did not run them.)
- `14` [stale] (fenced) `bun install` breaks the rule in `.claude/rules/dependencies.md` ("Never suggest `bun install` on its own in docs"). Use `mise install`.
- `21` [33][27] "Architectural research in `docs/RESEARCH_*.md`. Implementation plan at the path tracked in the repo's plan file." -> "Architectural research is in `docs/RESEARCH_*.md`." Cut the plan sentence or name the file; no plan file exists under `docs/`.
- `25` [13] "MIT — see [LICENSE](LICENSE)." -> "MIT. See [LICENSE](LICENSE)."

## assets/README.md

- `3` [33][32] "Static files baked into the aid binary via Bun's ... or copied to the build output." -> "This directory holds static files that aid either embeds in the binary through Bun's `with { type: "file" }` import attribute or copies to the build output."
- `5` [13][29][stale] "`scaffold/` — copied verbatim by `aid init` to a new project directory." -> `aid init` exits 1 with "not implemented" (src/cli/commands/init.ts:17). Rewrite: "`aid init` will copy `scaffold/` into a new project directory. The command is not implemented yet."
- `6` [13][stale] "`minisearch.min.js` — emitted at build time by `scripts/bundle-web.ts`..." -> Nothing emits this file. `src/web/search.ts` imports `minisearch` into the `aid-web` bundle. Delete the bullet.

## assets/scaffold/docs/index.md

- `8` [29] "This page lives at `docs/index.md` and is rendered as the site's landing page." -> "aid renders this page, `docs/index.md`, as the site's landing page."
- `13` [stale] "Drop OpenAPI specs (`*.yaml` / `*.json`) and `.proto` files into `docs/` and they'll render as sibling routes." -> "Add HTML pages, OpenAPI specs (`*.yaml`, `*.yml`, `*.json`), and `.proto` files to `docs/`. aid renders each one as its own route."
- `16` [27] "See the [aid PRODUCT_OVERVIEW](https://aid.tools)" -> "See [aid.tools](https://aid.tools) for the full feature list." The link text names a repo file but points to a website. I did not check whether aid.tools is live.

## tests/fixtures/sample-site/docs/index.md

- `2,6` "Sample Site" [fixture-asserted] (build.test.ts:53,57,118-119,167,170,199). It breaks rule 17 (title case), but it is a site name and the tests assert it, so leave it.
- `10` [fixture-asserted] "This is a small fixture exercising every page kind aid supports in v0.1:" -> The test asserts "small fixture" (build.test.ts:54); keep that substring. Optional rewrite: "This is a small fixture that covers every page kind aid supports in v0.1:".
- `10-14` [stale] The page claims "every page kind" but does not list the HTML page (`about.html`). Add "- [`about`](./about), a hand-written HTML page." That list text is not asserted, but rerun `bun test` after the change, because index.md feeds the search and llms assertions.
- `13-14` [13] "[`api`](./api) — an OpenAPI spec rendered with..." -> "[`api`](./api), an OpenAPI spec that aid renders with the embedded reference UI." Line 14 follows the same pattern. Tests do not assert these lines.

## src/cli/commands/help.ts

- `14` [11] "Subcommand to show help for." -> "Command to show help for." (This matches "Show help for a command." on line 8 and the arg name `command`.) Tests do not assert it.
- `3` (JSDoc, not user-facing) "sub-command" and "subcommand" are both used. Pick one.
- `8`, `48` No findings.

## .claude/CLAUDE.md

- `1` [13] "# `aid` — project instructions" -> "# `aid` project instructions"
- `7` [ASCII] "Bun ≥1.2" -> "Bun >= 1.2"
- `7-11` [15] Five bold "**Label:** value" bullets. They do not restate the line, but the bolding is decorative. Use a two-column table or plain "Runtime: ...".
- `17` [stale] "`bun run dev`": package.json has no `dev` script.
- `18` [stale] "`bun run build` | Bundle the browser-side runtime" -> `build` runs `scripts/compile.ts`, which builds the per-target release binaries. The browser bundle comes from `scripts/bundle-web.ts`, which has no script entry.
- `19` [stale] "`bun run compile`": package.json has no `compile` script.
- `28` [29] "path-scoped files load on demand when matching files are touched." -> "path-scoped files load when Claude touches a matching file."
- `32` [13] "Don't pre-emptively format files yourself — the hook will." -> "Do not format files yourself. The hook formats them."

## .claude/rules/css.md

- `8` [32] "Every rule must flow through a Tailwind 4 directive." -> "Every rule must use a Tailwind 4 directive."
- `12-20` [13] Nine "`@x` — description" em-dash bullets. Rewrite each as a sentence: "`@apply` composes utility classes into a rule.", "`@theme` declares design tokens (colors, fonts, spacing, and so on)." Line 14 also has a unicode ellipsis to replace.
- `15` [27] "`@layer` — `@layer base | components | utilities`" restates the directive. -> "`@layer` places rules in the `base`, `components`, or `utilities` layer."
- `25` [29] "One-off utility classes are introduced via `@utility name { @apply ... }`, not bare selectors..." -> "Introduce one-off utility classes with `@utility name { @apply ... }`, not with bare selectors that declare properties."
- `28` [30][24][27] "If you genuinely cannot express something via a directive, stop and raise it. There is almost always a directive that fits." -> "If no directive can express a rule, stop and raise it." Cut the second sentence.

## .claude/rules/dependencies.md

- `5,18,24,34,37,39` [33] The abbreviation "dep"/"deps" appears throughout. -> "dependency"/"dependencies"
- `7-14` [13] Eight em-dash definition bullets. Rewrite as sentences: "`Bun.serve` is an HTTP, WebSocket, and SSE server." Line 7 also uses "+" as a joiner [33].
- `23` [26] "Let the harness prompt fire" -> "Let the permission prompt fire"
- `24` [13][30] "Batch dep changes thoughtfully — one approval per logical change, not one per package." -> "Batch dependency changes so each logical change needs one approval, not one per package."
- `28` [13][30] "`bun install --cpu='*' --os='*'` — required so every platform subpackage ... A bare `bun install` silently filters..." -> "...runs `bun install --cpu='*' --os='*'`. The flags make every platform subpackage of ... land in `node_modules` for cross-compilation. A bare `bun install` filters out the platform-mismatched packages without a warning and breaks the compile pipeline."
- `28` [stale] The postinstall hook also runs `bun scripts/stage-natives.ts` and `bun run -F @aid/proto-ui build` (mise.toml).
- `30` [14] "After pulling, or whenever `package.json` / `bun.lock` changes: `mise install`." -> "Run `mise install` after pulling and whenever `package.json` or `bun.lock` changes."
- `36` [13] "unless there's a specific compatibility reason — document it inline if so." -> "...unless there is a specific compatibility reason. If there is one, document it inline."
- `37` [13] "(e.g. `"zod": "^4.4.3"`) — `bun add` writes this by default." -> "(e.g. `"zod": "^4.4.3"`). `bun add` writes this range by default."
- `37` [stale] package.json breaks this rule. It has `"minisearch": "^7"`, `"react": "^19"`, `"react-dom": "^19"`, `"@types/react": "^19"`, `"@types/react-dom": "^19"`, and `"typescript": "^5"`, all major-only ranges.
- `38` [32] "before reaching for a new package" -> "before adding a new package"

## .claude/rules/generated.md

- `13` [stale] "CI runs `bun run emit-schema -- --check`" -> `.github/workflows/ci.yml:30` runs `bun run scripts/emit-schema.ts --check`. The effect is the same, but the command text differs.
- `14` [13][32] "Don't add ad-hoc validation that duplicates Zod rules — extend the Zod schema instead so ... stay in lockstep." -> "Do not add ad-hoc validation that duplicates Zod rules. Extend the Zod schema instead, so the runtime validator and the published JSON Schema stay identical."

## .claude/rules/jsdoc.md

- No findings.

## .claude/rules/tests.md

- `9` [32] "The Bun runner is the contract." -> Cut it, or write "Every test must run under `bun test`."
- `11` [29][32] "Snapshot files (if introduced) commit alongside the test that produced them." -> "If you add snapshot files, commit them with the test that produced them."
- `12` [26] "exercise the public surface (CLI, public exports)" -> "exercise the public interface (the CLI and public exports)"
- `13` [29][30] "They are picked up automatically by `bun test`." -> "`bun test` finds them without configuration."

## Findings per file

| File | Style | Stale | Total |
|---|---|---|---|
| docs/BUILD.md | 33 | 13 | 46 |
| docs/LLMS_TXT.md | 20 | 4 | 24 |
| docs/DEV_SERVER.md | 23 | 2 | 25 |
| docs/HTML.md | 17 | 3 | 20 |
| README.md | 6 | 5 | 11 |
| assets/README.md | 3 | 2 | 5 |
| assets/scaffold/docs/index.md | 2 | 1 | 3 |
| tests/fixtures/sample-site/docs/index.md | 3 (2 fixture-asserted, leave or keep substring) | 1 | 4 |
| src/cli/commands/help.ts | 2 | 0 | 2 |
| .claude/CLAUDE.md | 5 | 3 | 8 |
| .claude/rules/css.md | 5 | 0 | 5 |
| .claude/rules/dependencies.md | 9 | 2 | 11 |
| .claude/rules/generated.md | 1 | 1 | 2 |
| .claude/rules/jsdoc.md | 0 | 0 | 0 |
| .claude/rules/tests.md | 4 | 0 | 4 |

The style counts are mechanical tallies of the bullets above. A bullet that groups several lines counts once.

Most important stale items:

- BUILD.md and LLMS_TXT.md still describe a two-renderer pipeline. They omit HTML, proto, and the search index, and say proto exports `.json` when the code exports `.proto`.
- `.claude/CLAUDE.md` lists the `dev` and `compile` scripts, which do not exist, and gives the wrong purpose for `build`.
- `assets/README.md` names `minisearch.min.js`, which nothing emits, and an `aid init` that is not implemented.
- The dev watcher ignores `--file`. That is a code bug, not only a doc problem.

I did not run any builds or tests. I checked each stale claim against the source by reading the code.
