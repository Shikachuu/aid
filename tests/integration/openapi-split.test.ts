import { afterEach, beforeEach, expect, test } from "bun:test"
import { mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { AidConfigSchema } from "../../src/core/config"
import { build } from "../../src/core/pipeline"
import type { BuildContext } from "../../src/core/types"

let cwd: string

beforeEach(async () => {
  cwd = await mkdtemp(path.join(tmpdir(), "aid-openapi-split-"))
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

test("prose-only site emits no openapi bundle or script tag", async () => {
  const ctx = await makeCtx()
  await Bun.write(path.join(ctx.contentDir, "index.md"), "# Hello\n\nJust prose, no specs.\n")
  await build(ctx)

  const entries = await readdir(ctx.outputDir)
  expect(entries.filter((e) => /^aid-openapi\./.test(e))).toEqual([])
  expect(entries.filter((e) => /^aid-web\.[a-z0-9]+\.js$/.test(e)).length).toBe(1)

  const html = await Bun.file(path.join(ctx.outputDir, "index.html")).text()
  expect(html).not.toContain("aid-openapi")
})

test("mixed site emits the openapi bundle once but only references it on openapi pages", async () => {
  const ctx = await makeCtx()
  await Bun.write(path.join(ctx.contentDir, "index.md"), "# Plain\n\nNo spec here.\n")
  await Bun.write(path.join(ctx.contentDir, "api.yaml"), PET_API)
  await build(ctx)

  const entries = await readdir(ctx.outputDir)
  expect(entries.filter((e) => /^aid-openapi\.[a-z0-9]+\.js$/.test(e)).length).toBe(1)

  const plain = await Bun.file(path.join(ctx.outputDir, "index.html")).text()
  expect(plain).not.toContain("aid-openapi")

  const api = await Bun.file(path.join(ctx.outputDir, "api", "index.html")).text()
  expect(api).toContain("aid-openapi")
  expect(api).toContain('class="aid-page aid-page-openapi"')
  expect(api).toContain('id="aid-openapi-spec"')
  expect(api).toContain('id="aid-openapi-mount"')
  expect(api).toContain("<h1>Pet API</h1>")
})

test("Swagger 2.0 source is upgraded to 3.1 in the rendered page", async () => {
  const ctx = await makeCtx()
  await Bun.write(
    path.join(ctx.contentDir, "legacy.yaml"),
    `swagger: "2.0"\ninfo:\n  title: Legacy\n  version: "1"\npaths:\n  /x:\n    get:\n      responses:\n        "200":\n          description: ok\n`,
  )
  await build(ctx)

  const html = await Bun.file(path.join(ctx.outputDir, "legacy", "index.html")).text()
  // The embedded spec script should hold the upgraded 3.1 document.
  const match = html.match(
    /<script type="application\/json" id="aid-openapi-spec">([\s\S]*?)<\/script>/,
  )
  expect(match).not.toBeNull()
  if (!match) {
    return
  }
  const spec = JSON.parse(match[1] ?? "") as { openapi?: string; swagger?: string }
  expect(spec.openapi).toMatch(/^3\.1/)
  expect(spec.swagger).toBeUndefined()
})
