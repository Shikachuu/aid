import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtemp, rm, symlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { AssetRegistry } from "../../src/core/assets"
import { copyStaticAssets } from "../../src/core/static"
import { makeCtx } from "../helpers"

let cwd: string

beforeEach(async () => {
  cwd = await mkdtemp(path.join(tmpdir(), "aid-static-"))
})

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true })
})

describe("copyStaticAssets", () => {
  test("no-ops when the static directory doesn't exist", async () => {
    const ctx = makeCtx(cwd)
    await expect(copyStaticAssets(ctx, new AssetRegistry())).resolves.toBeUndefined()
  })

  test("copies a single top-level file verbatim", async () => {
    const ctx = makeCtx(cwd)
    await Bun.write(path.join(ctx.staticDir, "logo.svg"), "<svg/>")

    await copyStaticAssets(ctx, new AssetRegistry())
    const dest = await Bun.file(path.join(ctx.outputDir, "logo.svg")).text()
    expect(dest).toBe("<svg/>")
  })

  test("preserves nested directory structure", async () => {
    const ctx = makeCtx(cwd)
    await Bun.write(path.join(ctx.staticDir, "img", "icons", "star.svg"), "<svg>star</svg>")
    await Bun.write(path.join(ctx.staticDir, "robots.txt"), "User-agent: *")

    await copyStaticAssets(ctx, new AssetRegistry())
    expect(await Bun.file(path.join(ctx.outputDir, "img/icons/star.svg")).text()).toBe(
      "<svg>star</svg>",
    )
    expect(await Bun.file(path.join(ctx.outputDir, "robots.txt")).text()).toBe("User-agent: *")
  })

  test("copies the target of a symlink inside the static dir", async () => {
    const ctx = makeCtx(cwd)
    await Bun.write(path.join(ctx.staticDir, "img", "logo.svg"), "<svg/>")
    await symlink(path.join(ctx.staticDir, "img"), path.join(ctx.staticDir, "images"))

    await copyStaticAssets(ctx, new AssetRegistry())
    expect(await Bun.file(path.join(ctx.outputDir, "images/logo.svg")).text()).toBe("<svg/>")
  })

  test("rejects a symlink whose target is outside the static dir", async () => {
    const ctx = makeCtx(cwd)
    await Bun.write(path.join(cwd, "secret.txt"), "secret")
    await Bun.write(path.join(ctx.staticDir, "keep.txt"), "keep")
    await symlink(path.join(cwd, "secret.txt"), path.join(ctx.staticDir, "secret.txt"))

    await expect(copyStaticAssets(ctx, new AssetRegistry())).rejects.toThrow(
      /resolves through a symlink to .*secret\.txt, outside dir\.static/,
    )
  })

  test("overwrites existing destination files", async () => {
    const ctx = makeCtx(cwd)
    await Bun.write(path.join(ctx.outputDir, "logo.svg"), "<old/>")
    await Bun.write(path.join(ctx.staticDir, "logo.svg"), "<new/>")

    await copyStaticAssets(ctx, new AssetRegistry())
    expect(await Bun.file(path.join(ctx.outputDir, "logo.svg")).text()).toBe("<new/>")
  })
})
