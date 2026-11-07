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

  expect(await Bun.file(path.join(ctx.outputDir, "guides", "shared.svg")).exists()).toBe(true)
  const html = await Bun.file(path.join(ctx.outputDir, "guides", "index.html")).text()
  expect(html).toContain('src="/guides/shared.svg"')
})

test("same-named images in different subfolders keep their subpaths", async () => {
  const ctx = await makeSite(cwd)
  await Bun.write(path.join(ctx.contentDir, "guide", "light", "logo.svg"), "<svg>light</svg>")
  await Bun.write(path.join(ctx.contentDir, "guide", "dark", "logo.svg"), "<svg>dark</svg>")
  await Bun.write(
    path.join(ctx.contentDir, "guide", "index.md"),
    "# Guide\n\n![](./light/logo.svg)\n![](./dark/logo.svg)\n",
  )
  await build(ctx)

  const html = await Bun.file(path.join(ctx.outputDir, "guide", "index.html")).text()
  expect(html).toContain('src="/guide/light/logo.svg"')
  expect(html).toContain('src="/guide/dark/logo.svg"')
  expect(await Bun.file(path.join(ctx.outputDir, "guide", "light", "logo.svg")).text()).toBe(
    "<svg>light</svg>",
  )
  expect(await Bun.file(path.join(ctx.outputDir, "guide", "dark", "logo.svg")).text()).toBe(
    "<svg>dark</svg>",
  )
})

test("a parent-relative image keeps its subpath without the leading ..", async () => {
  const ctx = await makeSite(cwd)
  await Bun.write(path.join(ctx.contentDir, "img", "a.svg"), "<svg/>")
  await Bun.write(path.join(ctx.contentDir, "guides", "intro.md"), "# Intro\n\n![](../img/a.svg)\n")
  await build(ctx)

  const html = await Bun.file(path.join(ctx.outputDir, "guides", "intro", "index.html")).text()
  expect(html).toContain('src="/guides/intro/img/a.svg"')
  expect(await Bun.file(path.join(ctx.outputDir, "guides", "intro", "img", "a.svg")).exists()).toBe(
    true,
  )
})
