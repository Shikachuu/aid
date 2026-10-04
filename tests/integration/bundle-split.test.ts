import { afterEach, beforeEach, expect, test } from "bun:test"
import { mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { build } from "../../src/core/pipeline"
import { makeSite } from "../helpers"

let cwd: string

beforeEach(async () => {
  cwd = await mkdtemp(path.join(tmpdir(), "aid-bundle-split-"))
})

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true })
})

const PET_API = `openapi: "3.1.0"
info:
  title: Pet API
  version: "1.0.0"
paths:
  /pets:
    get:
      operationId: listPets
      summary: List pets
      responses:
        "200":
          description: ok
`

test("prose-only site emits no mermaid or openapi bundle or script tag", async () => {
  const ctx = await makeSite(cwd)
  await Bun.write(path.join(ctx.contentDir, "index.md"), "# Hello\n\nJust prose.\n")
  await build(ctx)

  const entries = await readdir(ctx.outputDir)
  expect(entries.filter((e) => /^aid-(mermaid|openapi)\./.test(e))).toEqual([])
  expect(entries.filter((e) => /^aid-web\.[a-z0-9]+\.js$/.test(e)).length).toBe(1)

  const html = await Bun.file(path.join(ctx.outputDir, "index.html")).text()
  expect(html).not.toContain("aid-mermaid")
  expect(html).not.toContain("aid-openapi")
})

test("mixed site emits the mermaid bundle once but only references it on mermaid pages", async () => {
  const ctx = await makeSite(cwd)
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

test("mixed site emits the openapi bundle once but only references it on openapi pages", async () => {
  const ctx = await makeSite(cwd)
  await Bun.write(path.join(ctx.contentDir, "index.md"), "# Plain\n\nNo spec here.\n")
  await Bun.write(path.join(ctx.contentDir, "api.yaml"), PET_API)
  await build(ctx)

  const entries = await readdir(ctx.outputDir)
  expect(entries.filter((e) => /^aid-openapi\.[a-z0-9]+\.js$/.test(e)).length).toBe(1)

  const plain = await Bun.file(path.join(ctx.outputDir, "index.html")).text()
  expect(plain).not.toContain("aid-openapi")

  const api = await Bun.file(path.join(ctx.outputDir, "api", "index.html")).text()
  expect(api).toContain("aid-openapi")
})
