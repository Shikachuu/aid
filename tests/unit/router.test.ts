import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { AidConfigSchema } from "../../src/core/config"
import { buildRoutes } from "../../src/core/router"
import type { BuildContext } from "../../src/core/types"

let cwd: string

beforeEach(async () => {
  cwd = await mkdtemp(path.join(tmpdir(), "aid-router-"))
})

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true })
})

function makeCtx(): BuildContext {
  const config = AidConfigSchema.parse({ name: "test" })
  return {
    config,
    cwd,
    contentDir: path.join(cwd, config.dir.content),
    outputDir: path.join(cwd, config.dir.output),
    templatesDir: null,
    staticDir: path.join(cwd, config.dir.static),
  }
}

async function writeMd(ctx: BuildContext, relative: string, body = "# T\n"): Promise<void> {
  await Bun.write(path.join(ctx.contentDir, relative), body)
}

describe("buildRoutes", () => {
  test("emits a route per .md file, sorted by path", async () => {
    const ctx = makeCtx()
    await writeMd(ctx, "index.md")
    await writeMd(ctx, "a.md")
    await writeMd(ctx, "b/index.md")
    const routes = await buildRoutes(ctx)
    expect(routes.map((r) => r.path)).toEqual(["/", "/a", "/b"])
    for (const r of routes) expect(r.kind).toBe("markdown")
  })

  test("excludes any path with a _-prefixed segment", async () => {
    const ctx = makeCtx()
    await writeMd(ctx, "index.md")
    await writeMd(ctx, "_drafts/wip.md")
    await writeMd(ctx, "products/_partial.md")
    await writeMd(ctx, "products/index.md")
    const routes = await buildRoutes(ctx)
    expect(routes.map((r) => r.path).sort()).toEqual(["/", "/products"])
  })

  test("throws on collision between foo.md and foo/index.md", async () => {
    const ctx = makeCtx()
    await writeMd(ctx, "products.md")
    await writeMd(ctx, "products/index.md")
    await expect(buildRoutes(ctx)).rejects.toThrow(/route collision/)
    await expect(buildRoutes(ctx)).rejects.toThrow(/products/)
  })
})
