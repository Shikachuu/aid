import { afterEach, beforeEach, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { compileTailwind } from "../../src/core/tailwind"
import { makeCtx } from "../helpers"

let cwd: string

beforeEach(async () => {
  cwd = await mkdtemp(path.join(tmpdir(), "aid-tailwind-pkg-"))
})

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true })
})

test("a folder import with a package.json resolves through the package, not index.css", async () => {
  const pkg = path.join(cwd, "pkg")
  await Bun.write(path.join(pkg, "package.json"), JSON.stringify({ style: "dist/styles.css" }))
  await Bun.write(path.join(pkg, "dist", "styles.css"), ".from-style { color: red; }\n")
  await Bun.write(path.join(pkg, "index.css"), ".from-index { color: red; }\n")
  await Bun.write(path.join(cwd, "main.css"), '@import "tailwindcss";\n@import "./pkg";\n')
  const css = await compileTailwind(makeCtx(cwd), [])
  expect(css).toContain(".from-style")
  expect(css).not.toContain(".from-index")
})
