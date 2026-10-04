import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { formatWithBiome } from "../../src/fmt/biome"
import { formatMarkdown } from "../../src/fmt/markdown"
import { formatOpenApi } from "../../src/fmt/openapi"
import { formatAll } from "../../src/fmt/orchestrate"

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "aid-fmt-"))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe("formatMarkdown", () => {
  test("collapses MD012 blank lines and is idempotent", async () => {
    const file = join(dir, "doc.md")
    await Bun.write(file, "# Title\n\n\n\nbody\n")
    await formatMarkdown([file], dir, { check: false })
    const after = await Bun.file(file).text()
    expect(after).not.toContain("\n\n\n\n")
    await formatMarkdown([file], dir, { check: false })
    const afterSecond = await Bun.file(file).text()
    expect(afterSecond).toBe(after)
  })

  test("--check reports wouldChange without writing", async () => {
    const file = join(dir, "doc.md")
    const original = "# Title\n\n\n\nbody\n"
    await Bun.write(file, original)
    const result = await formatMarkdown([file], dir, { check: true })
    expect(result.ok).toBe(false)
    expect(result.wouldChange).toContain(file)
    expect(await Bun.file(file).text()).toBe(original)
  })
})

describe("formatOpenApi", () => {
  test("canonicalizes JSON via JSON.stringify round-trip", async () => {
    const file = join(dir, "openapi.json")
    await Bun.write(file, '{"openapi":"3.0.0","info":{"title":"X","version":"1"},"paths":{}}')
    await formatOpenApi([file], dir, { check: false })
    const after = await Bun.file(file).text()
    expect(after).toContain("\n")
    expect(after.endsWith("\n")).toBe(true)
  })

  test("yaml round-trip is idempotent", async () => {
    const file = join(dir, "openapi.yaml")
    await Bun.write(file, "openapi: 3.0.0\ninfo:\n  title: X\n  version: '1'\npaths: {}\n")
    await formatOpenApi([file], dir, { check: false })
    const first = await Bun.file(file).text()
    await formatOpenApi([file], dir, { check: false })
    const second = await Bun.file(file).text()
    expect(second).toBe(first)
  })

  test.each([
    true,
    false,
  ])("reports an unparseable spec as an error and leaves it untouched (check: %p)", async (check) => {
    const file = join(dir, "openapi.json")
    const original = '{"openapi": "3.0.0",'
    await Bun.write(file, original)
    const result = await formatOpenApi([file], dir, { check })
    expect(result.ok).toBe(false)
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ file, severity: "error", code: "openapi/parse" }),
    ])
    expect(await Bun.file(file).text()).toBe(original)
  })
})

describe("formatWithBiome", () => {
  test("formats and is idempotent", async () => {
    const file = join(dir, "x.ts")
    await Bun.write(file, "const   x   =   1\nconsole.log( x )\n")
    await formatWithBiome([file], dir, { check: false })
    const first = await Bun.file(file).text()
    expect(first).not.toContain("   ")
    await formatWithBiome([file], dir, { check: false })
    const second = await Bun.file(file).text()
    expect(second).toBe(first)
  })

  test("--check reports wouldChange without writing", async () => {
    const file = join(dir, "x.ts")
    const original = "const   x   =   1\nconsole.log( x )\n"
    await Bun.write(file, original)
    const result = await formatWithBiome([file], dir, { check: true })
    expect(result.ok).toBe(false)
    expect(result.wouldChange).toContain(file)
    expect(await Bun.file(file).text()).toBe(original)
  })
})

describe("formatAll orchestrator", () => {
  test("end-to-end format pass over a mixed project", async () => {
    await Bun.write(join(dir, "doc.md"), "# Title\n\n\n\nbody\n")
    await Bun.write(join(dir, "x.ts"), "const   x = 1\n")
    const report = await formatAll({ dir, check: false, filter: null })
    expect(report.results.length).toBeGreaterThan(0)
  })
})
