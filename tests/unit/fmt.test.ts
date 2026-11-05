import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { formatWithBun } from "../../src/fmt/bun"
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

  test("yaml output stays block style with two-space indent and a trailing newline", async () => {
    const file = join(dir, "openapi.yaml")
    await Bun.write(file, "openapi: 3.0.0\ninfo:\n  title: X\n  version: '1'\npaths: {}\n")
    await formatOpenApi([file], dir, { check: false })
    const out = await Bun.file(file).text()
    expect(out).toContain("info:\n  title: X\n")
    expect(out.startsWith("{")).toBe(false)
    expect(out.endsWith("\n")).toBe(true)
    expect(out.endsWith("\n\n")).toBe(false)
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

  test.each([true, false])(
    "reports an unparseable spec as an error and leaves it untouched (check: %p)",
    async (check) => {
      const file = join(dir, "openapi.json")
      const original = '{"openapi": "3.0.0",'
      await Bun.write(file, original)
      const result = await formatOpenApi([file], dir, { check })
      expect(result.ok).toBe(false)
      expect(result.diagnostics).toEqual([
        expect.objectContaining({ file, severity: "error", code: "openapi/parse" }),
      ])
      expect(await Bun.file(file).text()).toBe(original)
    },
  )
})

describe("formatWithBun", () => {
  test("formats with the bundled options and is idempotent", async () => {
    const file = join(dir, "x.ts")
    await Bun.write(file, "const   x   =   { a: 'b' };\nconsole.log( x )\n")
    await formatWithBun([file], dir, { check: false })
    const first = await Bun.file(file).text()
    expect(first).toBe('const x = { a: "b" }\nconsole.log(x)\n')
    await formatWithBun([file], dir, { check: false })
    expect(await Bun.file(file).text()).toBe(first)
  })

  test("--check reports wouldChange without writing", async () => {
    const file = join(dir, "x.ts")
    const original = "const   x   =   1\n"
    await Bun.write(file, original)
    await Bun.write(join(dir, "ok.ts"), "export const y = 1\n")
    const result = await formatWithBun([file, join(dir, "ok.ts")], dir, { check: true })
    expect(result.ok).toBe(false)
    expect(result.wouldChange).toEqual([file])
    expect(await Bun.file(file).text()).toBe(original)
  })

  test("uses a project Prettier config instead of the bundled options", async () => {
    await Bun.write(join(dir, ".prettierrc"), '{ "semi": true, "singleQuote": true }\n')
    const file = join(dir, "x.ts")
    await Bun.write(file, 'const x = "a"\n')
    await formatWithBun([file], dir, { check: false })
    expect(await Bun.file(file).text()).toBe("const x = 'a';\n")
  })

  test("reports a file it cannot parse", async () => {
    const file = join(dir, "x.ts")
    await Bun.write(file, "const = 1\n")
    const result = await formatWithBun([file], dir, { check: true })
    expect(result.ok).toBe(false)
    expect(result.diagnostics[0]).toMatchObject({ file, line: 1, code: "bun/format" })
  })
})

describe("formatWithBun --check with other configs", () => {
  for (const [name, content] of [
    [".prettierrc", "{}\n"],
    [".oxfmtrc.json", "{}\n"],
  ] as const) {
    test(`lists the files a ${name} project would reformat`, async () => {
      await Bun.write(join(dir, name), content)
      const file = join(dir, "b.js")
      await Bun.write(file, "const   b = 1\n")
      await Bun.write(join(dir, "c.js"), "export const c = 1;\n")
      const result = await formatWithBun([file, join(dir, "c.js")], dir, { check: true })
      expect(result.ok).toBe(false)
      expect(result.wouldChange).toEqual([file])
    })
  }

  test("fails when bun fmt fails without naming a file", async () => {
    await Bun.write(join(dir, "bunfig.toml"), "[fmt]\nnotAnOption = true\n")
    const file = join(dir, "x.ts")
    await Bun.write(file, "export const x = 1\n")
    const result = await formatWithBun([file], dir, { check: true })
    expect(result.ok).toBe(false)
    expect(result.diagnostics[0]?.code).toBe("bun/format")
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
