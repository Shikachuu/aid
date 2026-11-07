import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { AssetRegistry } from "../../src/core/assets"
import { buildWebBundle } from "../../src/core/web-bundle"
import {
  bundleWebFiles,
  entryPointOf,
  hasSourceTree,
  requireEmbedded,
  WEB_JS,
} from "../../src/core/web-entries"
import { makeCtx } from "../helpers"

let cwd: string

beforeEach(async () => {
  cwd = await mkdtemp(path.join(tmpdir(), "aid-web-bundle-"))
})

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true })
})

describe("requireEmbedded", () => {
  test("returns the embedded bytes", () => {
    expect(requireEmbedded("aid-web", "console.log(1)")).toBe("console.log(1)")
  })

  test("names the bundle and the fix when the bytes are empty", () => {
    expect(() => requireEmbedded("aid-web", "")).toThrow(
      /^aid: aid-web has no embedded bytes.*bun run build/,
    )
  })
})

describe("web entries", () => {
  test("hasSourceTree is true inside the repository", async () => {
    expect(await hasSourceTree()).toBe(true)
  })

  test("bundleWebFiles fails with the entry source on a build error", async () => {
    const entry = { ...WEB_JS.base, source: "src/web/does-not-exist.ts" } as const
    const original = console.error
    console.error = () => {}
    try {
      await expect(bundleWebFiles(entry as never)).rejects.toThrow(
        "failed to bundle src/web/does-not-exist.ts",
      )
    } finally {
      console.error = original
    }
  })

  test("bundleWebFiles splits mermaid into a small entry and lazy chunks", async () => {
    const bundle = await bundleWebFiles(WEB_JS.mermaid)
    const names = Object.keys(bundle.files)
    expect(names).toContain(bundle.entry)
    expect(names.length).toBeGreaterThan(1)
    expect(names.every((name) => /^aid-mermaid\.[\w.-]+\.js$/.test(name))).toBe(true)
    expect(bundle.files[bundle.entry]?.length).toBeLessThan(100_000)
  }, 60_000)

  test("entryPointOf throws when no output is an entry point", () => {
    expect(() => entryPointOf(WEB_JS.base, [])).toThrow(
      "no entry-point output for src/web/index.ts",
    )
  })
})

describe("buildWebBundle", () => {
  test("registers every bundle output, chunks included", async () => {
    const ctx = makeCtx(cwd)
    const registry = new AssetRegistry()
    const web = await buildWebBundle(ctx, registry, { mermaid: true, openapi: false, proto: false })
    await registry.flush()
    const written = await readdir(ctx.outputDir)
    expect(written.filter((f) => f.startsWith("aid-mermaid.")).length).toBeGreaterThan(1)
    for (const file of written) {
      expect(() => registry.register(path.join(ctx.outputDir, file), "static/x")).toThrow(
        /asset collision/,
      )
    }
    expect(web.mermaidHref).toMatch(/^\/aid-mermaid\.[a-z0-9]+\.js$/)
    expect(web.openapiHref).toBeNull()
  })

  test("refuses to overwrite a static file with the same name as a bundle", async () => {
    const ctx = makeCtx(cwd)
    const { baseHref } = await buildWebBundle(ctx, new AssetRegistry(), {
      mermaid: false,
      openapi: false,
      proto: false,
    })
    const registry = new AssetRegistry()
    registry.register(path.join(ctx.outputDir, path.posix.basename(baseHref)), "static/app.js")
    await expect(
      buildWebBundle(ctx, registry, { mermaid: false, openapi: false, proto: false }),
    ).rejects.toThrow(/asset collision.*static\/app\.js/)
  })
})
