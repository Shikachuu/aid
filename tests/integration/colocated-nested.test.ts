import { afterEach, beforeEach, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { AidConfigSchema } from "../../src/core/config"
import { build } from "../../src/core/pipeline"
import type { BuildContext } from "../../src/core/types"

let cwd: string

beforeEach(async () => {
  cwd = await mkdtemp(path.join(tmpdir(), "aid-colocated-nested-"))
})

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true })
})

async function makeCtx(overrides: { base_path?: string } = {}): Promise<BuildContext> {
  const config = AidConfigSchema.parse({
    name: "test",
    base_path: overrides.base_path ?? "/",
  })
  const ctx: BuildContext = {
    config,
    cwd,
    contentDir: path.join(cwd, config.dir.content),
    outputDir: path.join(cwd, config.dir.output),
    templatesDir: null,
    staticDir: path.join(cwd, config.dir.static),
  }
  await Bun.write(path.join(cwd, "main.css"), `@import "tailwindcss";\n@import "aid/theme";\n`)
  return ctx
}

test("nested route's colocated image lands under the route dir with the right href", async () => {
  const ctx = await makeCtx()
  const pageDir = path.join(ctx.contentDir, "products", "stocks")
  await Bun.write(path.join(pageDir, "diagram.svg"), "<svg>x</svg>")
  await Bun.write(path.join(pageDir, "index.md"), "# Stocks\n\n![](./diagram.svg)\n")
  await build(ctx)

  expect(
    await Bun.file(path.join(ctx.outputDir, "products", "stocks", "diagram.svg")).exists(),
  ).toBe(true)
  const html = await Bun.file(path.join(ctx.outputDir, "products", "stocks", "index.html")).text()
  expect(html).toContain('src="/products/stocks/diagram.svg"')
})

test("base_path is honored in the rewritten src", async () => {
  const ctx = await makeCtx({ base_path: "/docs" })
  await Bun.write(path.join(ctx.contentDir, "hero.svg"), "<svg/>")
  await Bun.write(path.join(ctx.contentDir, "index.md"), "# Root\n\n![](./hero.svg)\n")
  await build(ctx)

  const html = await Bun.file(path.join(ctx.outputDir, "index.html")).text()
  expect(html).toContain('src="/docs/hero.svg"')
})

test("colocated image one level up from the route still resolves correctly", async () => {
  const ctx = await makeCtx()
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
