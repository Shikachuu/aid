import { afterAll, beforeAll, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import pkg from "../../packages/proto-ui/package.json"

const PACKAGE_ROOT = path.resolve(import.meta.dir, "../../packages/proto-ui")
let outdir = ""

beforeAll(async () => {
  outdir = await mkdtemp(path.join(tmpdir(), "aid-proto-ui-build-"))
  await Bun.$`${process.execPath} run scripts/build.ts --outdir ${outdir}`.cwd(PACKAGE_ROOT).quiet()
}, 120_000)

afterAll(async () => {
  await rm(outdir, { recursive: true, force: true })
})

const exportTargets = (value: unknown): string[] =>
  typeof value === "string"
    ? [value]
    : Object.values(value as Record<string, unknown>).flatMap(exportTargets)

test("every exports target exists after a build", async () => {
  const targets = exportTargets(pkg.exports)
  expect(targets.some((t) => t.startsWith("./dist/"))).toBe(true)
  const missing: string[] = []
  for (const target of targets) {
    const file = target.startsWith("./dist/")
      ? path.join(outdir, target.slice("./dist/".length))
      : path.join(PACKAGE_ROOT, target)
    if (!(await Bun.file(file).exists())) {
      missing.push(target)
    }
  }
  expect(missing).toEqual([])
})
