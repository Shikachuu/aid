import { afterEach, beforeEach, expect, test } from "bun:test"
import { chmod, mkdir, mkdtemp, rm, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { stableTempFile } from "../../src/core/internal/extract-embedded"

let prefix: string
let scratch: string

beforeEach(async () => {
  prefix = `test-${crypto.randomUUID()}`
  scratch = await mkdtemp(path.join(tmpdir(), "aid-extract-test-"))
})

afterEach(async () => {
  await rm(scratch, { recursive: true, force: true })
  for await (const dir of new Bun.Glob(`aid-*-${prefix}-*`).scan({
    cwd: tmpdir(),
    onlyFiles: false,
  })) {
    await rm(path.join(tmpdir(), dir), { recursive: true, force: true })
  }
})

test("reuses one private file across calls", async () => {
  const first = await stableTempFile(prefix, "bin", "payload", 0o755)
  const { ino, mtimeMs } = await stat(first)
  const second = await stableTempFile(prefix, "bin", "payload", 0o755)
  expect(second).toBe(first)
  const again = await stat(second)
  expect(again.ino).toBe(ino)
  expect(again.mtimeMs).toBe(mtimeMs)
  expect(await Bun.file(first).text()).toBe("payload")
  expect((await stat(path.dirname(first))).mode & 0o777).toBe(0o700)
  expect((await stat(first)).mode & 0o777).toBe(0o755)
})

test("different content gets a different path", async () => {
  const a = await stableTempFile(prefix, "bin", "one")
  const b = await stableTempFile(prefix, "bin", "two")
  expect(a).not.toBe(b)
})

test("refuses a pre-existing directory that other users can open", async () => {
  const target = await stableTempFile(prefix, "bin", "x")
  const dir = path.dirname(target)
  await rm(dir, { recursive: true })
  await mkdir(dir)
  await chmod(dir, 0o755)
  await expect(stableTempFile(prefix, "bin", "x")).rejects.toThrow(/not a private directory/)
})
