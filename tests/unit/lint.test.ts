import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { lintWithBiome } from "../../src/lint/biome"
import { lintMarkdown } from "../../src/lint/markdown"
import { lintOpenApi } from "../../src/lint/openapi"
import { lintAll } from "../../src/lint/orchestrate"

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "aid-lint-"))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe("lintMarkdown", () => {
  test("flags MD012 (multiple consecutive blank lines) under default config", async () => {
    const file = join(dir, "doc.md")
    await Bun.write(file, "# Title\n\n\n\nbody\n")
    const result = await lintMarkdown([file], dir)
    expect(result.tool).toBe("md")
    expect(result.ok).toBe(false)
    expect(result.diagnostics.some((d) => d.code === "MD012")).toBe(true)
  })

  test("respects user config that disables MD012", async () => {
    const fixtureDir = join(
      import.meta.dir,
      "..",
      "fixtures",
      "lint-fixtures",
      "with-user-md-config",
    )
    const result = await lintMarkdown([join(fixtureDir, "index.md")], fixtureDir)
    expect(result.diagnostics.find((d) => d.code === "MD012")).toBeUndefined()
  })

  test("returns ok:true when no files passed", async () => {
    const result = await lintMarkdown([], dir)
    expect(result.ok).toBe(true)
    expect(result.diagnostics).toEqual([])
  })
})

describe("lintOpenApi", () => {
  test("flags missing info.description on a minimal spec", async () => {
    const file = join(dir, "openapi.yaml")
    await Bun.write(file, "openapi: 3.0.0\ninfo:\n  title: Test\n  version: 1.0.0\npaths: {}\n")
    const result = await lintOpenApi([file], dir)
    expect(result.tool).toBe("openapi")
    const codes = result.diagnostics.map((d) => d.code)
    expect(codes).toContain("info-description")
  })
})

describe("lintWithBiome", () => {
  test("flags useConst on a TS file with let-but-never-reassigned", async () => {
    const file = join(dir, "x.ts")
    await Bun.write(file, "let x = 1\nconsole.log(x)\n")
    const result = await lintWithBiome([file], dir, { fix: false })
    expect(result.tool).toBe("biome")
    const codes = result.diagnostics.map((d) => d.code)
    expect(codes.some((c) => c.includes("useConst"))).toBe(true)
  })

  test("--fix rewrites the file with safe fixes applied", async () => {
    const file = join(dir, "x.ts")
    await Bun.write(file, "let x = 1\nconsole.log(x)\n")
    await lintWithBiome([file], dir, { fix: true })
    const after = await Bun.file(file).text()
    expect(after).toContain("const x")
  })
})

describe("lintAll orchestrator", () => {
  test("centralized discovery + per-format dispatch", async () => {
    await Bun.write(join(dir, "doc.md"), "# Title\n\n\n\nbody\n")
    await Bun.write(join(dir, "x.ts"), "let x = 1\nconsole.log(x)\n")
    const report = await lintAll({ dir, fix: false, filter: null })
    expect(report.ok).toBe(false)
    const tools = report.results.map((r) => r.tool)
    expect(tools).toContain("md")
    expect(tools).toContain("biome")
  })

  test("filter restricts dispatch to a single tool", async () => {
    await Bun.write(join(dir, "doc.md"), "# Title\n\n\n\nbody\n")
    await Bun.write(join(dir, "x.ts"), "let x = 1\nconsole.log(x)\n")
    const report = await lintAll({ dir, fix: false, filter: new Set(["md"]) })
    expect(report.results.every((r) => r.tool === "md")).toBe(true)
  })
})
