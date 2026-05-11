import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { AidConfigSchema } from "../../src/core/config"
import { writeCss } from "../../src/core/css-writer"
import type { BuildContext } from "../../src/core/types"

let cwd: string

beforeEach(async () => {
  cwd = await mkdtemp(path.join(tmpdir(), "aid-css-writer-"))
})

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true })
})

function makeCtx(overrides: { base_path?: string } = {}): BuildContext {
  const config = AidConfigSchema.parse({
    name: "test",
    base_path: overrides.base_path ?? "/",
  })
  const outputDir = path.join(cwd, config.dir.output)
  return {
    config,
    cwd,
    contentDir: path.join(cwd, config.dir.content),
    outputDir,
    templatesDir: null,
  }
}

describe("writeCss", () => {
  test("writes the CSS to disk at the expected path", async () => {
    const ctx = makeCtx()
    const css = ".foo { color: red; }"
    const result = await writeCss({ ctx, css })
    expect(path.basename(result.path)).toMatch(/^main\.[0-9a-f]{8}\.css$/)
    expect(path.dirname(result.path)).toBe(ctx.outputDir)
    const onDisk = await Bun.file(result.path).text()
    expect(onDisk).toBe(css)
  })

  test("identical CSS produces identical filename and href", async () => {
    const ctx = makeCtx()
    const css = ".a { color: blue; }"
    const first = await writeCss({ ctx, css })
    const second = await writeCss({ ctx, css })
    expect(first.path).toBe(second.path)
    expect(first.href).toBe(second.href)
  })

  test("different CSS produces different filenames", async () => {
    const ctx = makeCtx()
    const a = await writeCss({ ctx, css: ".a { color: blue; }" })
    const b = await writeCss({ ctx, css: ".b { color: green; }" })
    expect(path.basename(a.path)).not.toBe(path.basename(b.path))
  })

  test("href uses '/' base_path correctly", async () => {
    const ctx = makeCtx({ base_path: "/" })
    const result = await writeCss({ ctx, css: ".x{}" })
    expect(result.href).toMatch(/^\/main\.[0-9a-f]{8}\.css$/)
  })

  test("href uses subpath base_path correctly", async () => {
    const ctx = makeCtx({ base_path: "/docs" })
    const result = await writeCss({ ctx, css: ".x{}" })
    expect(result.href).toMatch(/^\/docs\/main\.[0-9a-f]{8}\.css$/)
  })

  test("href handles trailing slash in base_path", async () => {
    const ctx = makeCtx({ base_path: "/docs/" })
    const result = await writeCss({ ctx, css: ".x{}" })
    expect(result.href).not.toContain("//")
    expect(result.href).toMatch(/^\/docs\/main\.[0-9a-f]{8}\.css$/)
  })

  test("creates outputDir if it doesn't exist", async () => {
    const ctx = makeCtx()
    await rm(ctx.outputDir, { recursive: true, force: true })
    const result = await writeCss({ ctx, css: ".y { color: black; }" })
    const onDisk = await Bun.file(result.path).text()
    expect(onDisk).toBe(".y { color: black; }")
  })
})
