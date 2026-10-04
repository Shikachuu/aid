import { afterEach, beforeEach, expect, test } from "bun:test"
import { mkdtemp, rm, symlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { build } from "../../src/core/pipeline"
import { makeSite } from "../helpers"

let cwd: string

beforeEach(async () => {
  cwd = await mkdtemp(path.join(tmpdir(), "aid-security-"))
})

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true })
})

test("blocks colocated <img src> that escapes contentDir", async () => {
  const ctx = await makeSite(cwd)
  await Bun.write(path.join(cwd, "secret.txt"), "TOP SECRET")
  await Bun.write(path.join(ctx.contentDir, "index.md"), "# Attack\n\n![](../secret.txt)\n")
  await expect(build(ctx)).rejects.toThrow(/escapes contentDir/)
  expect(await Bun.file(path.join(ctx.outputDir, "secret.txt")).exists()).toBe(false)
})

test("blocks a colocated symlink that resolves outside contentDir", async () => {
  const ctx = await makeSite(cwd)
  await Bun.write(path.join(cwd, "secret.txt"), "TOP SECRET")
  await Bun.write(path.join(ctx.contentDir, "index.md"), "# Attack\n\n![](./link.txt)\n")
  await symlink(path.join(cwd, "secret.txt"), path.join(ctx.contentDir, "link.txt"))
  await expect(build(ctx)).rejects.toThrow(/escapes contentDir/)
  expect(await Bun.file(path.join(ctx.outputDir, "link.txt")).exists()).toBe(false)
})

test("copies a colocated asset whose name starts with ..", async () => {
  const ctx = await makeSite(cwd)
  await Bun.write(path.join(ctx.contentDir, "..hero.svg"), "<svg>dots</svg>")
  await Bun.write(path.join(ctx.contentDir, "index.md"), "# Dots\n\n![](./..hero.svg)\n")
  await build(ctx)
  expect(await Bun.file(path.join(ctx.outputDir, "..hero.svg")).text()).toBe("<svg>dots</svg>")
})

test("hard-errors when static/ and a colocated asset target the same path", async () => {
  const ctx = await makeSite(cwd)
  await Bun.write(path.join(ctx.staticDir, "hero.svg"), "<svg>static</svg>")
  await Bun.write(path.join(ctx.contentDir, "hero.svg"), "<svg>colocated</svg>")
  await Bun.write(path.join(ctx.contentDir, "index.md"), "# Collide\n\n![](./hero.svg)\n")
  await expect(build(ctx)).rejects.toThrow(/asset collision/)
})

test("hard-errors when two routes collide", async () => {
  const ctx = await makeSite(cwd)
  await Bun.write(path.join(ctx.contentDir, "products.md"), "# A\n")
  await Bun.write(path.join(ctx.contentDir, "products", "index.md"), "# B\n")
  await expect(build(ctx)).rejects.toThrow(/route collision/)
})
