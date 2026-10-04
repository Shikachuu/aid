import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { AssetRegistry } from "../../src/core/assets"
import { AidConfigSchema } from "../../src/core/config"
import { copyStaticAssets } from "../../src/core/static"
import type { BuildContext } from "../../src/core/types"

let cwd: string

beforeEach(async () => {
  cwd = await mkdtemp(path.join(tmpdir(), "aid-static-"))
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

describe("copyStaticAssets", () => {
  test("no-ops when the static directory doesn't exist", async () => {
    const ctx = makeCtx()
    await expect(copyStaticAssets(ctx, new AssetRegistry())).resolves.toBeUndefined()
  })

  test("copies a single top-level file verbatim", async () => {
    const ctx = makeCtx()
    await Bun.write(path.join(ctx.staticDir, "logo.svg"), "<svg/>")

    await copyStaticAssets(ctx, new AssetRegistry())
    const dest = await Bun.file(path.join(ctx.outputDir, "logo.svg")).text()
    expect(dest).toBe("<svg/>")
  })

  test("preserves nested directory structure", async () => {
    const ctx = makeCtx()
    await Bun.write(path.join(ctx.staticDir, "img", "icons", "star.svg"), "<svg>star</svg>")
    await Bun.write(path.join(ctx.staticDir, "robots.txt"), "User-agent: *")

    await copyStaticAssets(ctx, new AssetRegistry())
    expect(await Bun.file(path.join(ctx.outputDir, "img/icons/star.svg")).text()).toBe(
      "<svg>star</svg>",
    )
    expect(await Bun.file(path.join(ctx.outputDir, "robots.txt")).text()).toBe("User-agent: *")
  })

  test("overwrites existing destination files", async () => {
    const ctx = makeCtx()
    await Bun.write(path.join(ctx.outputDir, "logo.svg"), "<old/>")
    await Bun.write(path.join(ctx.staticDir, "logo.svg"), "<new/>")

    await copyStaticAssets(ctx, new AssetRegistry())
    expect(await Bun.file(path.join(ctx.outputDir, "logo.svg")).text()).toBe("<new/>")
  })
})
