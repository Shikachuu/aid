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
  await cp(fixtureDir, cwd, { recursive: true })
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
  // The rendered HTML uses `block` in the main element; proves @source scanning
  // of bundled components/rendered HTML picked up utilities.
  expect(css).toMatch(/\.block\s*\{/)
})
