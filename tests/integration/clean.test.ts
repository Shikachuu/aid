import { afterEach, beforeEach, expect, test } from "bun:test"
import { cp, mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

const repoRoot = path.join(import.meta.dir, "../..")
const cliEntry = path.join(repoRoot, "src/cli/index.ts")
const fixtureDir = path.join(import.meta.dir, "../fixtures/sample-site")

let cwd: string

beforeEach(async () => {
  cwd = await mkdtemp(path.join(tmpdir(), "aid-clean-"))
  await cp(fixtureDir, cwd, {
    recursive: true,
    filter: (src) => path.basename(src) !== "dist",
  })
})

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true })
})

const runBuild = (...args: string[]) =>
  Bun.spawnSync([process.execPath, cliEntry, "build", cwd, ...args], {
    cwd: repoRoot,
    stdout: "pipe",
    stderr: "pipe",
  })

test("--clean drops output left by a deleted page", async () => {
  const stale = path.join(cwd, "dist/gone/index.html")
  await Bun.write(stale, "stale")
  expect(runBuild("--clean").exitCode).toBe(0)
  expect(await Bun.file(stale).exists()).toBe(false)
  expect(await Bun.file(path.join(cwd, "dist/index.html")).exists()).toBe(true)
  expect(await Bun.file(path.join(cwd, "aid.yaml")).exists()).toBe(true)
})

test("--clean refuses an output dir that is the project dir", async () => {
  const config = await Bun.file(path.join(cwd, "aid.yaml")).text()
  await Bun.write(path.join(cwd, "aid.yaml"), `${config}\ndir:\n  output: .\n`)
  const result = runBuild("--clean")
  expect(result.exitCode).not.toBe(0)
  expect(result.stderr.toString()).toContain("aid: dir.output")
  expect(await Bun.file(path.join(cwd, "aid.yaml")).exists()).toBe(true)
  expect(await Bun.file(path.join(cwd, "docs/index.md")).exists()).toBe(true)
})
