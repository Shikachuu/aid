import { afterEach, beforeEach, expect, test } from "bun:test"
import { cp, mkdtemp, rm, symlink } from "node:fs/promises"
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
  await rm(`${cwd}-public`, { recursive: true, force: true })
  await rm(`${cwd}-link`, { force: true })
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

test("--clean refuses an output dir outside the project, but a plain build may write there", async () => {
  const config = await Bun.file(path.join(cwd, "aid.yaml")).text()
  await Bun.write(
    path.join(cwd, "aid.yaml"),
    `${config}\ndir:\n  output: ../${path.basename(cwd)}-public\n`,
  )
  const refused = runBuild("--clean")
  expect(refused.exitCode).not.toBe(0)
  expect(refused.stderr.toString()).toContain("must be a subdirectory of the project directory")
  expect(runBuild().exitCode).toBe(0)
})

test("--clean refuses an output dir that is a symlink to the content dir", async () => {
  await symlink(path.join(cwd, "docs"), path.join(cwd, "out"))
  const config = await Bun.file(path.join(cwd, "aid.yaml")).text()
  await Bun.write(path.join(cwd, "aid.yaml"), `${config}\ndir:\n  output: out\n`)
  const result = runBuild("--clean")
  expect(result.exitCode).not.toBe(0)
  expect(result.stderr.toString()).toContain("overlaps dir.content")
  expect(await Bun.file(path.join(cwd, "docs/index.md")).exists()).toBe(true)
})

test("a plain build refuses an output dir that is a symlink to the content dir", async () => {
  await symlink(path.join(cwd, "docs"), path.join(cwd, "out"))
  const config = await Bun.file(path.join(cwd, "aid.yaml")).text()
  await Bun.write(path.join(cwd, "aid.yaml"), `${config}\ndir:\n  output: out\n`)
  const result = runBuild()
  expect(result.exitCode).not.toBe(0)
  expect(result.stderr.toString()).toContain("overlaps dir.content")
  expect(await Bun.file(path.join(cwd, "docs/index.html")).exists()).toBe(false)
})

test("--clean works through a symlinked project path before the output dir exists", async () => {
  const link = `${cwd}-link`
  await symlink(cwd, link)
  const result = Bun.spawnSync([process.execPath, cliEntry, "build", link, "--clean"], {
    cwd: repoRoot,
    stderr: "pipe",
  })
  expect(result.exitCode).toBe(0)
  expect(await Bun.file(path.join(cwd, "dist/index.html")).exists()).toBe(true)
})

test("a plain build refuses an output dir that is a symlink to the static dir", async () => {
  await symlink(path.join(cwd, "static"), path.join(cwd, "out"))
  const config = await Bun.file(path.join(cwd, "aid.yaml")).text()
  await Bun.write(path.join(cwd, "aid.yaml"), `${config}\ndir:\n  output: out\n`)
  const result = runBuild()
  expect(result.exitCode).not.toBe(0)
  expect(result.stderr.toString()).toContain("overlaps dir.static")
})
