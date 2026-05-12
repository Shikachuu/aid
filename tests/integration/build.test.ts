import { afterEach, beforeEach, expect, test } from "bun:test"
import { cp, mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { loadConfig } from "../../src/core/config"
import { build } from "../../src/core/pipeline"
import type { BuildContext } from "../../src/core/types"

let cwd: string

const fixtureDir = path.join(import.meta.dir, "../fixtures/sample-site")

beforeEach(async () => {
  cwd = await mkdtemp(path.join(tmpdir(), "aid-build-"))
  // Skip the fixture's `dist/` — it's a gitignored artefact from prior local
  // builds, and if its hashed filenames differ from this run's the assertions
  // see two `main.*.css` entries instead of one.
  await cp(fixtureDir, cwd, {
    recursive: true,
    filter: (src) => path.basename(src) !== "dist",
  })
})

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true })
})

test("produces dist/index.html linking a hashed main CSS for the sample fixture", async () => {
  const config = await loadConfig(path.join(cwd, "aid.yaml"))
  const ctx: BuildContext = {
    config,
    cwd,
    contentDir: path.join(cwd, config.dir.content),
    outputDir: path.join(cwd, config.dir.output),
    templatesDir: config.dir.templates === "" ? null : path.join(cwd, config.dir.templates),
    staticDir: path.join(cwd, config.dir.static),
  }

  await build(ctx)

  const indexPath = path.join(ctx.outputDir, "index.html")
  expect(await Bun.file(indexPath).exists()).toBe(true)

  const entries = await readdir(ctx.outputDir)
  const cssMatches = entries.filter((e) => /^main\.[0-9a-f]{8}\.css$/.test(e))
  expect(cssMatches.length).toBe(1)
  const cssFilename = cssMatches[0] as string

  const html = await Bun.file(indexPath).text()
  expect(html).toContain(`<link rel="stylesheet" href="/${cssFilename}">`)
  expect(html).not.toContain("__AID_STYLESHEET_HREF__")
  // Markdown body content reaches the rendered HTML.
  expect(html).toContain("Sample Site")
  expect(html).toContain("small fixture")
  // Exactly one <h1> per page — no duplicate from PageMarkdown chrome.
  expect((html.match(/<h1\b/g) ?? []).length).toBe(1)
  // Headings get slugged ids and an appended # anchor span.
  expect(html).toMatch(/<h1 id="sample-site">/)
  expect(html).toContain('class="aid-heading-anchor"')
  // Shiki dual-theme highlighting reaches the rendered HTML.
  expect(html).toContain('class="shiki')
  expect(html).toContain("language-ts")
  expect(html).toContain("--shiki-light:")
  expect(html).toContain("--shiki-dark:")
  // Mermaid fence rewritten to <pre class="mermaid">; shiki didn't touch it.
  expect(html).toContain('<pre class="mermaid">')
  expect(html).toContain("graph LR")
  // Base web bundle is emitted with a hashed filename and linked on every page.
  const webMatches = entries.filter((e) => /^aid-web\.[a-z0-9]+\.js$/.test(e))
  expect(webMatches.length).toBe(1)
  const webFilename = webMatches[0] as string
  expect(html).toContain(`<script type="module" src="/${webFilename}" defer>`)
  // Mermaid bundle is emitted only because the fixture has a mermaid block,
  // and the script tag for it is injected only on the pages that use it.
  const mermaidEntries = entries.filter((e) => /^aid-mermaid\.[a-z0-9]+\.js$/.test(e))
  expect(mermaidEntries.length).toBe(1)
  const mermaidFilename = mermaidEntries[0] as string
  expect(html).toContain(`<script type="module" src="/${mermaidFilename}" defer>`)

  // Top-level static/ is copied verbatim into the output root.
  expect(await Bun.file(path.join(ctx.outputDir, "logo.svg")).exists()).toBe(true)
  // Colocated images next to the markdown source land beside the rendered page
  // and the <img src> is rewritten to point at the absolute output path.
  expect(await Bun.file(path.join(ctx.outputDir, "hero.svg")).exists()).toBe(true)
  expect(html).toContain('src="/hero.svg"')
  expect(html).not.toContain("./hero.svg")

  const css = await Bun.file(path.join(ctx.outputDir, cssFilename)).text()
  // The fixture's main.css overrides --color-aid-accent via @theme; proves the
  // user stylesheet drives the compile.
  expect(css).toContain("--color-aid-accent")
  // The fixture opts into the aid theme via `@import "aid/theme"`; the bundled
  // component layer must reach the compiled CSS, otherwise the default Layout
  // renders unstyled even though Tailwind ran.
  expect(css).toMatch(/\.aid-shell\s*\{/)
  expect(css).toMatch(/\.aid-page-markdown\s+pre\s*\{/)
  // Base @theme tokens from the bundled aid theme (not just the user override)
  // make it through too.
  expect(css).toContain("--color-aid-bg")

  // The OpenAPI page in the fixture should pull in Scalar's bundled stylesheet
  // alongside the JS runtime — without it Scalar renders unstyled (icons at
  // intrinsic size, no chrome). The link is gated to OpenAPI pages only.
  const openapiHtml = await Bun.file(path.join(ctx.outputDir, "api", "index.html")).text()
  const openapiCssMatches = entries.filter((e) => /^aid-openapi\.[0-9a-f]{8}\.css$/.test(e))
  expect(openapiCssMatches.length).toBe(1)
  const openapiCssFilename = openapiCssMatches[0] as string
  expect(openapiHtml).toContain(`<link rel="stylesheet" href="/${openapiCssFilename}">`)
  // Prose-only pages don't pay for it.
  expect(html).not.toContain(openapiCssFilename)

  // Markdown sidechain: every markdown route emits a sibling `.md` file with
  // the same public href for colocated images as the HTML. Root `/` → index.md.
  const mdPath = path.join(ctx.outputDir, "index.md")
  expect(await Bun.file(mdPath).exists()).toBe(true)
  const md = await Bun.file(mdPath).text()
  expect(md.startsWith("---")).toBe(false)
  expect(md).not.toContain("title: Sample Site")
  expect(md).toMatch(/^# Sample Site/)
  expect(md).toContain("/hero.svg")
  expect(md).not.toContain("./hero.svg")
  // OpenAPI `.json` sidechain: every OpenAPI route emits a sibling `.json`
  // file carrying the normalized spec, so LLMs and tooling can fetch it
  // alongside the rendered reference UI.
  const jsonPath = path.join(ctx.outputDir, "api.json")
  expect(await Bun.file(jsonPath).exists()).toBe(true)
  const spec = (await Bun.file(jsonPath).json()) as {
    openapi?: string
    info?: { title?: string }
    paths?: Record<string, unknown>
  }
  expect(spec.openapi).toMatch(/^3\./)
  expect(spec.info?.title).toBe("Sample API")
  expect(spec.paths?.["/pets"]).toBeDefined()

  // HTML page: the fixture's about.html is wrapped in the Layout shell, its
  // <title> drives the document title, colocated images get the same public-
  // href treatment as markdown, and a sibling about.md sidechain is emitted.
  const aboutHtmlPath = path.join(ctx.outputDir, "about", "index.html")
  expect(await Bun.file(aboutHtmlPath).exists()).toBe(true)
  const aboutHtml = await Bun.file(aboutHtmlPath).text()
  expect(aboutHtml).toContain("About the Fixture")
  expect(aboutHtml).toContain('class="aid-page aid-page-html"')
  // <title> reaches the document <title>.
  expect(aboutHtml).toMatch(/<title>[^<]*About the Fixture[^<]*<\/title>/)
  // Colocated <img src="./hero.svg"> rewritten to the route-scoped output path.
  expect(await Bun.file(path.join(ctx.outputDir, "about", "hero.svg")).exists()).toBe(true)
  expect(aboutHtml).toContain('src="/about/hero.svg"')
  expect(aboutHtml).not.toContain("./hero.svg")
  // Mermaid block in the HTML body triggers the mermaid bundle for this page.
  expect(aboutHtml).toContain(`<script type="module" src="/${mermaidFilename}" defer>`)
  // .md sidechain: about.html → about.md with a sibling URL, containing the
  // converted body and the same image href as the HTML output.
  const aboutMdPath = path.join(ctx.outputDir, "about.md")
  expect(await Bun.file(aboutMdPath).exists()).toBe(true)
  const aboutMd = await Bun.file(aboutMdPath).text()
  expect(aboutMd).toContain("About the Fixture")
  expect(aboutMd).toContain("/about/hero.svg")

  // llms.txt: the bundled default template fires (the fixture has no
  // templates/llms.txt override), so the file ships with the site name, the
  // description blockquote, and a `## Docs` section listing every page by its
  // machine-readable URL.
  const llmsTxtPath = path.join(ctx.outputDir, "llms.txt")
  expect(await Bun.file(llmsTxtPath).exists()).toBe(true)
  const llmsTxt = await Bun.file(llmsTxtPath).text()
  expect(llmsTxt).toMatch(/^# Sample Site/m)
  expect(llmsTxt).toContain("> Fixture used by aid's integration tests.")
  expect(llmsTxt).toContain("## Docs")
  expect(llmsTxt).toContain("[Sample Site](/index.md)")
  expect(llmsTxt).toContain("[Sample API](/api.json)")
  expect(llmsTxt).toContain("[About the Fixture](/about.md)")
  expect(llmsTxt).not.toContain("{{")

  // search-index: every build with `search.enabled` (the fixture leaves it on)
  // emits a hashed `search-index.<hash>.js` at the site root, and the rendered
  // SearchBox carries the public href + per-format weights as data attributes
  // so the client knows where to fetch the index from.
  const searchIndexMatches = entries.filter((e) => /^search-index\.[0-9a-f]{8}\.js$/.test(e))
  expect(searchIndexMatches.length).toBe(1)
  const searchIndexFilename = searchIndexMatches[0] as string
  expect(html).toContain(`data-aid-search-index-href="/${searchIndexFilename}"`)
  expect(html).toContain(`data-aid-search-typo-tolerance="0.2"`)
  // Weights serialise as JSON with double-quoted keys; the HTML encoder swaps
  // those for &quot; inside attribute values.
  expect(html).toMatch(/data-aid-search-weights="\{[^"]*&quot;openapi&quot;:2[^"]*\}"/)

  // The emitted index file is a self-bootstrapping JS that assigns
  // window.__AID_SEARCH__ to MiniSearch's serialized JSON.
  const searchIndexSrc = await Bun.file(path.join(ctx.outputDir, searchIndexFilename)).text()
  expect(searchIndexSrc.startsWith("window.__AID_SEARCH__=")).toBe(true)
  expect(searchIndexSrc.endsWith(";")).toBe(true)
  const payload = JSON.parse(searchIndexSrc.slice("window.__AID_SEARCH__=".length, -1)) as {
    storedFields: Record<string, { type: string; title: string; url: string }>
  }
  const stored = Object.values(payload.storedFields)
  // Every routed markdown/html/openapi page is in the index.
  const titles = stored.map((d) => d.title).sort()
  expect(titles).toContain("Sample Site")
  expect(titles).toContain("About the Fixture")
  expect(titles).toContain("Sample API")
  // OpenAPI extras enrichment reaches the index: a query for `listPets` should
  // hit the API page.
  const { default: MiniSearch } = await import("minisearch")
  const ms = (
    MiniSearch as unknown as {
      loadJSON: (
        json: string,
        options: { fields: string[]; storeFields: string[] },
      ) => { search: (q: string) => Array<{ title: unknown }> }
    }
  ).loadJSON(searchIndexSrc.slice("window.__AID_SEARCH__=".length, -1), {
    fields: ["title", "headings", "body", "extras"],
    storeFields: ["type", "title", "url"],
  })
  const hits = ms.search("listPets")
  expect(hits.length).toBeGreaterThan(0)
  expect(hits[0]?.title).toBe("Sample API")
})
