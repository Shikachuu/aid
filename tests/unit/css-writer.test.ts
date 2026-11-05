import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { AssetRegistry } from "../../src/core/assets"
import type { BuildContext } from "../../src/core/types"
import { writeHashed } from "../../src/core/web-bundle"
import { makeCtx } from "../helpers"

let cwd: string

beforeEach(async () => {
  cwd = await mkdtemp(path.join(tmpdir(), "aid-css-writer-"))
})

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true })
})

async function writeCss({ ctx, css }: { ctx: BuildContext; css: string }) {
  const registry = new AssetRegistry()
  const href = writeHashed(ctx, registry, "main", "css", css)
  await registry.flush()
  return { href, path: path.join(ctx.outputDir, path.posix.basename(href)) }
}

describe("writeHashed (main.css)", () => {
  test("writes the CSS to disk at the expected path", async () => {
    const ctx = makeCtx(cwd)
    const css = ".foo { color: red; }"
    const result = await writeCss({ ctx, css })
    expect(path.basename(result.path)).toMatch(/^main\.[0-9a-f]{8}\.css$/)
    expect(path.dirname(result.path)).toBe(ctx.outputDir)
    const onDisk = await Bun.file(result.path).text()
    expect(onDisk).toBe(css)
  })

  test("identical CSS produces identical filename and href", async () => {
    const ctx = makeCtx(cwd)
    const css = ".a { color: blue; }"
    const first = await writeCss({ ctx, css })
    const second = await writeCss({ ctx, css })
    expect(first.path).toBe(second.path)
    expect(first.href).toBe(second.href)
  })

  test("different CSS produces different filenames", async () => {
    const ctx = makeCtx(cwd)
    const a = await writeCss({ ctx, css: ".a { color: blue; }" })
    const b = await writeCss({ ctx, css: ".b { color: green; }" })
    expect(path.basename(a.path)).not.toBe(path.basename(b.path))
  })

  test("href uses '/' base_path correctly", async () => {
    const ctx = makeCtx(cwd, { base_path: "/" })
    const result = await writeCss({ ctx, css: ".x{}" })
    expect(result.href).toMatch(/^\/main\.[0-9a-f]{8}\.css$/)
  })

  test("href uses subpath base_path correctly", async () => {
    const ctx = makeCtx(cwd, { base_path: "/docs" })
    const result = await writeCss({ ctx, css: ".x{}" })
    expect(result.href).toMatch(/^\/docs\/main\.[0-9a-f]{8}\.css$/)
  })

  test("a file already registered at the same path is a collision", async () => {
    const ctx = makeCtx(cwd)
    const registry = new AssetRegistry()
    const href = writeHashed(ctx, registry, "main", "css", ".x{}")
    const taken = new AssetRegistry()
    taken.register(path.join(ctx.outputDir, path.posix.basename(href)), "static/main.css")
    expect(() => writeHashed(ctx, taken, "main", "css", ".x{}")).toThrow(
      /asset collision.*static\/main\.css/,
    )
  })

  test("href handles trailing slash in base_path", async () => {
    const ctx = makeCtx(cwd, { base_path: "/docs/" })
    const result = await writeCss({ ctx, css: ".x{}" })
    expect(result.href).not.toContain("//")
    expect(result.href).toMatch(/^\/docs\/main\.[0-9a-f]{8}\.css$/)
  })
})
