import { afterEach, beforeEach, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { build } from "../../src/core/pipeline"
import { makeSite } from "../helpers"

let cwd: string

beforeEach(async () => {
  cwd = await mkdtemp(path.join(tmpdir(), "aid-colocated-nested-"))
})

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true })
})

test("nested route's colocated image lands under the route dir with the right href", async () => {
  const ctx = await makeSite(cwd)
  const pageDir = path.join(ctx.contentDir, "products", "stocks")
  await Bun.write(path.join(pageDir, "diagram.svg"), "<svg>x</svg>")
  await Bun.write(path.join(pageDir, "index.md"), "# Stocks\n\n![](./diagram.svg)\n")
  await build(ctx)

  expect(
    await Bun.file(path.join(ctx.outputDir, "products", "stocks", "diagram.svg")).exists(),
  ).toBe(true)
  const html = await Bun.file(path.join(ctx.outputDir, "products", "stocks", "index.html")).text()
  expect(html).toContain('src="/products/stocks/diagram.svg"')

  // Sidechain `.md` is a sibling of the route folder, not nested inside it.
  const mdPath = path.join(ctx.outputDir, "products", "stocks.md")
  expect(await Bun.file(mdPath).exists()).toBe(true)
  const md = await Bun.file(mdPath).text()
  expect(md).toContain("/products/stocks/diagram.svg")
  expect(md).not.toContain("./diagram.svg")
})

test("base_path is honored in the rewritten src", async () => {
  const ctx = await makeSite(cwd, { base_path: "/docs" })
  await Bun.write(path.join(ctx.contentDir, "hero.svg"), "<svg/>")
  await Bun.write(path.join(ctx.contentDir, "index.md"), "# Root\n\n![](./hero.svg)\n")
  await build(ctx)

  const html = await Bun.file(path.join(ctx.outputDir, "index.html")).text()
  expect(html).toContain('src="/docs/hero.svg"')

  // `.md` sidechain picks up the same base_path-prefixed href.
  const md = await Bun.file(path.join(ctx.outputDir, "index.md")).text()
  expect(md).toContain("/docs/hero.svg")
})

test("colocated image one level up from the route still resolves correctly", async () => {
  const ctx = await makeSite(cwd)
  await Bun.write(path.join(ctx.contentDir, "shared.svg"), "<svg/>")
  await Bun.write(
    path.join(ctx.contentDir, "guides", "index.md"),
    "# Guide\n\n![](../shared.svg)\n",
  )
  await build(ctx)

  // The file lands in the guides/ output dir (not the source location).
  expect(await Bun.file(path.join(ctx.outputDir, "guides", "shared.svg")).exists()).toBe(true)
  const html = await Bun.file(path.join(ctx.outputDir, "guides", "index.html")).text()
  expect(html).toContain('src="/guides/shared.svg"')
})
