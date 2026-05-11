import { afterEach, beforeEach, expect, test } from "bun:test"
import { mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { AidConfigSchema } from "../../src/core/config"
import { build } from "../../src/core/pipeline"
import type { BuildContext } from "../../src/core/types"

let cwd: string

beforeEach(async () => {
  cwd = await mkdtemp(path.join(tmpdir(), "aid-mermaid-split-"))
})

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true })
})

async function makeCtx(): Promise<BuildContext> {
  const config = AidConfigSchema.parse({ name: "test" })
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

test("prose-only site emits no mermaid bundle or script tag", async () => {
  const ctx = await makeCtx()
  await Bun.write(path.join(ctx.contentDir, "index.md"), "# Hello\n\nJust prose, no diagrams.\n")
  await build(ctx)

  const entries = await readdir(ctx.outputDir)
  // No mermaid bundle output.
  expect(entries.filter((e) => /^aid-mermaid\./.test(e))).toEqual([])
  // Base bundle is still present.
  expect(entries.filter((e) => /^aid-web\.[a-z0-9]+\.js$/.test(e)).length).toBe(1)

  const html = await Bun.file(path.join(ctx.outputDir, "index.html")).text()
  expect(html).not.toContain("aid-mermaid")
})

test("mixed site emits the mermaid bundle once but only references it on mermaid pages", async () => {
  const ctx = await makeCtx()
  await Bun.write(path.join(ctx.contentDir, "index.md"), "# Plain\n\nNo diagrams here.\n")
  await Bun.write(
    path.join(ctx.contentDir, "diagram.md"),
    "# With Diagram\n\n```mermaid\ngraph LR\n  A --> B\n```\n",
  )
  await build(ctx)

  const entries = await readdir(ctx.outputDir)
  expect(entries.filter((e) => /^aid-mermaid\.[a-z0-9]+\.js$/.test(e)).length).toBe(1)

  const plain = await Bun.file(path.join(ctx.outputDir, "index.html")).text()
  expect(plain).not.toContain("aid-mermaid")

  const diagram = await Bun.file(path.join(ctx.outputDir, "diagram", "index.html")).text()
  expect(diagram).toContain("aid-mermaid")
})
