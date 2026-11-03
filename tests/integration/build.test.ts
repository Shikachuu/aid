import { afterAll, beforeAll, expect, test } from "bun:test"
import { cp, mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { loadBuildContext } from "../../src/core/config"
import { build } from "../../src/core/pipeline"
import { parseSearchIndexScript } from "../helpers"

const fixtureDir = path.join(import.meta.dir, "../fixtures/sample-site")

const isBuildOutputDir = (src: string) => path.basename(src) === "dist"

let cwd: string
let outputDir: string
let entries: string[]
let html: string

beforeAll(async () => {
  cwd = await mkdtemp(path.join(tmpdir(), "aid-build-"))
  await cp(fixtureDir, cwd, { recursive: true, filter: (src) => !isBuildOutputDir(src) })
  const ctx = await loadBuildContext(cwd, "aid.yaml")
  await build(ctx)
  outputDir = ctx.outputDir
  entries = await readdir(outputDir)
  html = await readOutput("index.html")
})

afterAll(async () => {
  await rm(cwd, { recursive: true, force: true })
})

function outputExists(...segments: string[]) {
  return Bun.file(path.join(outputDir, ...segments)).exists()
}

function readOutput(...segments: string[]) {
  return Bun.file(path.join(outputDir, ...segments)).text()
}

function singleHashedEntry(pattern: RegExp): string {
  const matches = entries.filter((e) => pattern.test(e))
  expect(matches.length).toBe(1)
  return matches[0] as string
}

test("index.html links the single hashed main stylesheet", async () => {
  expect(await outputExists("index.html")).toBe(true)
  const cssFilename = singleHashedEntry(/^main\.[0-9a-f]{8}\.css$/)
  expect(html).toContain(`<link rel="stylesheet" href="/${cssFilename}">`)
  expect(html).not.toContain("__AID_STYLESHEET_HREF__")
})

test("markdown body renders with one <h1> and anchored, slugged headings", () => {
  expect(html).toContain("Sample Site")
  expect(html).toContain("small fixture")
  expect((html.match(/<h1\b/g) ?? []).length).toBe(1)
  expect(html).toMatch(/<h1 id="sample-site">/)
  expect(html).toContain('class="aid-heading-anchor"')
})

test("code fences get shiki dual-theme highlighting", () => {
  expect(html).toContain('class="shiki')
  expect(html).toContain("language-ts")
  expect(html).toContain("--shiki-light:")
  expect(html).toContain("--shiki-dark:")
})

test('mermaid fences become <pre class="mermaid"> with raw source', () => {
  expect(html).toContain('<pre class="mermaid">')
  expect(html).toContain("graph LR")
})

test("every page links the hashed base web bundle", () => {
  const webFilename = singleHashedEntry(/^aid-web\.[a-z0-9]+\.js$/)
  expect(html).toContain(`<script type="module" src="/${webFilename}"></script>`)
})

test("markdown pages with a mermaid block link the hashed mermaid bundle", () => {
  const mermaidFilename = singleHashedEntry(/^aid-mermaid\.[a-z0-9]+\.js$/)
  expect(html).toContain(`<script type="module" src="/${mermaidFilename}"></script>`)
})

test("top-level static/ is copied into the output root", async () => {
  expect(await outputExists("logo.svg")).toBe(true)
})

test("colocated markdown images are copied beside the page with an absolute src", async () => {
  expect(await outputExists("hero.svg")).toBe(true)
  expect(html).toContain('src="/hero.svg"')
  expect(html).not.toContain("./hero.svg")
})

test("compiled CSS carries the fixture's @theme accent override", async () => {
  const css = await readOutput(singleHashedEntry(/^main\.[0-9a-f]{8}\.css$/))
  expect(css).toContain("--color-aid-accent")
})

test("compiled CSS includes the bundled aid theme components and base tokens", async () => {
  const css = await readOutput(singleHashedEntry(/^main\.[0-9a-f]{8}\.css$/))
  expect(css).toMatch(/\.aid-shell\s*\{/)
  expect(css).toMatch(/\.aid-page-markdown\s+pre\s*[,{]/)
  expect(css).toContain("--color-aid-bg")
})

test("only OpenAPI pages link the Scalar stylesheet", async () => {
  const openapiHtml = await readOutput("api", "index.html")
  const openapiCssFilename = singleHashedEntry(/^aid-openapi\.[0-9a-f]{8}\.css$/)
  expect(openapiHtml).toContain(`<link rel="stylesheet" href="/${openapiCssFilename}">`)
  expect(html).not.toContain(openapiCssFilename)
})

test("root markdown route emits a frontmatter-free index.md with public image hrefs", async () => {
  expect(await outputExists("index.md")).toBe(true)
  const md = await readOutput("index.md")
  expect(md.startsWith("---")).toBe(false)
  expect(md).not.toContain("title: Sample Site")
  expect(md).toMatch(/^# Sample Site/)
  expect(md).toContain("/hero.svg")
  expect(md).not.toContain("./hero.svg")
})

test("OpenAPI route emits a sibling api.json with the normalized spec", async () => {
  expect(await outputExists("api.json")).toBe(true)
  const spec = (await Bun.file(path.join(outputDir, "api.json")).json()) as {
    openapi?: string
    info?: { title?: string }
    paths?: Record<string, unknown>
  }
  expect(spec.openapi).toMatch(/^3\./)
  expect(spec.info?.title).toBe("Sample API")
  expect(spec.paths?.["/pets"]).toBeDefined()
})

test("fixture sidebar links every page and marks the current one", () => {
  const nav = html.match(/<nav class="aid-nav"[\s\S]*?<\/nav>/)?.[0] ?? ""
  expect(nav).toContain('href="/" aria-current="page"')
  expect(nav).toContain('href="/about"')
  expect(nav).toContain('href="/api"')
  expect(nav).toContain('href="/events"')
})

test("about.html is wrapped in the layout shell and its <title> becomes the document title", async () => {
  expect(await outputExists("about", "index.html")).toBe(true)
  const aboutHtml = await readOutput("about", "index.html")
  expect(aboutHtml).toContain("About the Fixture")
  expect(aboutHtml).toContain('class="aid-page aid-page-html"')
  expect(aboutHtml).toMatch(/<title>[^<]*About the Fixture[^<]*<\/title>/)
})

test("HTML page colocated images are copied to the route-scoped output path", async () => {
  const aboutHtml = await readOutput("about", "index.html")
  expect(await outputExists("about", "hero.svg")).toBe(true)
  expect(aboutHtml).toContain('src="/about/hero.svg"')
  expect(aboutHtml).not.toContain("./hero.svg")
})

test("HTML pages with a mermaid block link the mermaid bundle", async () => {
  const aboutHtml = await readOutput("about", "index.html")
  const mermaidFilename = singleHashedEntry(/^aid-mermaid\.[a-z0-9]+\.js$/)
  expect(aboutHtml).toContain(`<script type="module" src="/${mermaidFilename}"></script>`)
})

test("HTML page emits a sibling about.md with the converted body and public image href", async () => {
  expect(await outputExists("about.md")).toBe(true)
  const aboutMd = await readOutput("about.md")
  expect(aboutMd).toContain("About the Fixture")
  expect(aboutMd).toContain("/about/hero.svg")
})

test("llms.txt from the default template lists every page by its machine-readable URL", async () => {
  expect(await outputExists("llms.txt")).toBe(true)
  const llmsTxt = await readOutput("llms.txt")
  expect(llmsTxt).toMatch(/^# Sample Site/m)
  expect(llmsTxt).toContain("> Fixture used by aid's integration tests.")
  expect(llmsTxt).toContain("## Docs")
  expect(llmsTxt).toContain("[Sample Site](/index.md)")
  expect(llmsTxt).toContain("[Sample API](/api.json)")
  expect(llmsTxt).toContain("[About the Fixture](/about.md)")
  expect(llmsTxt).not.toContain("{{")
})

test("SearchBox carries the hashed index href, typo tolerance, and HTML-escaped weights", () => {
  const searchIndexFilename = singleHashedEntry(/^search-index\.[0-9a-f]{8}\.js$/)
  expect(html).toContain(`data-aid-search-index-href="/${searchIndexFilename}"`)
  expect(html).toContain(`data-aid-search-typo-tolerance="0.2"`)
  expect(html).toMatch(/data-aid-search-weights="\{[^"]*&quot;openapi&quot;:2[^"]*\}"/)
})

test("search index stores every routed markdown, html, and openapi page", async () => {
  const source = await readOutput(singleHashedEntry(/^search-index\.[0-9a-f]{8}\.js$/))
  const titles = parseSearchIndexScript(source).docs.map((d) => d.title)
  expect(titles).toContain("Sample Site")
  expect(titles).toContain("About the Fixture")
  expect(titles).toContain("Sample API")
})

test("search index matches OpenAPI operation ids to the API page", async () => {
  const source = await readOutput(singleHashedEntry(/^search-index\.[0-9a-f]{8}\.js$/))
  const hits = parseSearchIndexScript(source).search("listPets")
  expect(hits.length).toBeGreaterThan(0)
  expect(hits[0]?.title).toBe("Sample API")
})

test("JSON Schema route renders static field docs without the OpenAPI or proto runtimes", async () => {
  const userHtml = await readOutput("user", "index.html")
  expect(userHtml).toContain('class="aid-page aid-page-jsonschema"')
  expect(userHtml).toContain('<details class="aid-schema-field" id="prop-id" open>')
  expect(userHtml).toContain("aid-schema-chip-required")
  expect(userHtml).toContain('<a href="#def-Category">')
  expect(userHtml).not.toMatch(/aid-openapi\.[0-9a-f]{8}\.(js|css)/)
  expect(userHtml).not.toMatch(/aid-proto\.[0-9a-f]{8}\.(js|css)/)
})

test("theme CSS carries the JSON Schema chip classes", async () => {
  const css = await readOutput(singleHashedEntry(/^main\.[0-9a-f]{8}\.css$/))
  expect(css).toMatch(/\.aid-schema-chip-required\s*\{/)
  expect(css).toMatch(/\.aid-schema-field-summary\s*\{/)
})

test("JSON Schema route exports the schema as user.json and lists it in llms.txt and search", async () => {
  const schema = (await Bun.file(path.join(outputDir, "user.json")).json()) as { title?: string }
  expect(schema.title).toBe("User")
  expect(await readOutput("llms.txt")).toContain("[User](/user.json)")
  const source = await readOutput(singleHashedEntry(/^search-index\.[0-9a-f]{8}\.js$/))
  const index = parseSearchIndexScript(source)
  expect(index.docs).toContainEqual({ type: "jsonschema", title: "User", url: "/user" })
  expect(index.search("nickname")[0]?.title).toBe("User")
})
