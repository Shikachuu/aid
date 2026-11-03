import { afterAll, beforeAll, expect, test } from "bun:test"
import { cp, mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { loadBuildContext } from "../../src/core/config"
import { build } from "../../src/core/pipeline"

const scaffoldDir = path.join(import.meta.dir, "../../assets/scaffold")

let cwd: string
let css: string

beforeAll(async () => {
  cwd = await mkdtemp(path.join(tmpdir(), "aid-scaffold-"))
  await cp(scaffoldDir, cwd, { recursive: true })
  const ctx = await loadBuildContext(cwd, "aid.yaml")
  await build(ctx)
  const cssFile = (await readdir(ctx.outputDir)).find((e) => /^main\.[0-9a-f]{8}\.css$/.test(e))
  css = await Bun.file(path.join(ctx.outputDir, cssFile as string)).text()
})

afterAll(async () => {
  await rm(cwd, { recursive: true, force: true })
})

test("scaffold stylesheet pulls in the bundled theme components", () => {
  expect(css).toMatch(/\.aid-shell\s*\{/)
  expect(css).toContain("--color-aid-accent")
})

test("compiled theme styles the search results dropdown", () => {
  expect(css).toMatch(/\.aid-search-results\s*\{[^}]*position:\s*absolute/)
  expect(css).toMatch(/\.aid-search-result\s*\{/)
  expect(css).toContain('aria-selected="true"')
})

test("compiled theme styles markdown and HTML page content", () => {
  expect(css).toMatch(/:where\(\.aid-page-markdown, \.aid-page-html\) h2\s*\{/)
  expect(css).toMatch(
    /:where\(\.aid-page-markdown, \.aid-page-html\) ul\s*\{[^}]*list-style-type:\s*disc/,
  )
})

test("aid tokens reach the proto-ui root, which declares its own defaults", () => {
  expect(css).toMatch(
    /\.aid-page-proto \.proto-root\s*\{[^}]*--proto-color-accent:\s*var\(--color-aid-accent\)/,
  )
})
