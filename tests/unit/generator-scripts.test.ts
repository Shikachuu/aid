import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { checkStaged, collectStaged } from "../../scripts/check-binaries"
import { driftedFiles, orphanedFiles } from "../../scripts/generated-files"
import { lcssNodeFile, TARGETS } from "../../scripts/natives"
import { stageNatives } from "../../scripts/stage-natives"

const ROOT = path.join(import.meta.dir, "../..")

let root: string

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "aid-generators-"))
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe("driftedFiles", () => {
  test("lists missing and changed files, not matching ones", async () => {
    await Bun.write(path.join(root, "same.txt"), "a\n")
    await Bun.write(path.join(root, "changed.txt"), "old\n")
    const drifted = await driftedFiles(root, [
      { path: "same.txt", content: "a\n" },
      { path: "changed.txt", content: "new\n" },
      { path: "missing.txt", content: "x\n" },
    ])
    expect(drifted).toEqual(["changed.txt", "missing.txt"])
  })
})

describe("orphanedFiles", () => {
  test("lists files under the owned dir that no generator writes", async () => {
    await Bun.write(path.join(root, "ref", "kept.md"), "a\n")
    await Bun.write(path.join(root, "ref", "old", "gone.md"), "b\n")
    await Bun.write(path.join(root, "other.md"), "c\n")
    expect(await orphanedFiles(root, "ref", [{ path: "ref/kept.md", content: "a\n" }])).toEqual([
      "ref/old/gone.md",
    ])
  })

  test("treats a missing dir as having no orphans", async () => {
    expect(await orphanedFiles(root, "missing", [])).toEqual([])
  })
})

describe("--check CLIs", () => {
  test.each([
    ["gen-bunfig", "[gen-bunfig] bunfig.toml and .prettierrc.json are in sync."],
    ["gen-css-data", "[gen-css-data] src/lint/css-data.json is in sync."],
    ["emit-schema", "[emit-schema] schema is in sync."],
    ["gen-docs", "[gen-docs] reference pages are in sync."],
  ])("%s --check exits 0 on the committed files", (script, message) => {
    const proc = Bun.spawnSync([process.execPath, `scripts/${script}.ts`, "--check"], {
      cwd: ROOT,
      stderr: "pipe",
    })
    expect(proc.stderr.toString()).toBe("")
    expect(proc.stdout.toString().trim()).toBe(message)
    expect(proc.exitCode).toBe(0)
  })
})

describe("stageNatives", () => {
  test("copies installed bindings to vendor/natives and skips missing ones", async () => {
    const [installed, ...missing] = TARGETS.map((t) => t.lcssSubpkg)
    const name = installed ?? ""
    await Bun.write(path.join(root, "node_modules", name, lcssNodeFile(name)), "binding")
    const warn = spyOn(console, "warn").mockImplementation(() => undefined)
    const log = spyOn(console, "log").mockImplementation(() => undefined)
    let warnings = 0
    try {
      await stageNatives(root)
      warnings = warn.mock.calls.length
    } finally {
      warn.mockRestore()
      log.mockRestore()
    }
    expect(await Bun.file(path.join(root, "vendor/natives", `${name}.bin`)).text()).toBe("binding")
    expect(warnings).toBe(missing.length)
    expect(checkStaged(await collectStaged(root))).toEqual(
      missing.map((pkg) => `${pkg} source binding is not installed (run \`mise install\`)`),
    )
  })
})
