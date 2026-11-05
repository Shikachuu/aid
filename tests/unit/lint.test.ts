import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, relative } from "node:path"
import { lintWithBun } from "../../src/lint/bun"
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

  test("--fix writes safe fixes and reports the meaning-changing ones it skipped", async () => {
    const file = join(dir, "doc.md")
    await Bun.write(file, "# Title\n\n\n\nCompute a * b * c now.\n")
    const result = await lintMarkdown([file], dir, { fix: true })
    expect(await Bun.file(file).text()).toBe("# Title\n\nCompute a * b * c now.\n")
    expect(new Set(result.diagnostics.map((d) => d.code))).toEqual(new Set(["MD037"]))
    expect(result.ok).toBe(false)
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

describe("lintWithBun", () => {
  test("flags prefer-const with the bundled rules", async () => {
    const file = join(dir, "x.ts")
    await Bun.write(file, "let x = 1\nconsole.log(x)\n")
    const result = await lintWithBun([file], dir, { fix: false })
    expect(result.tool).toBe("bun")
    expect(result.diagnostics.map((d) => d.code)).toEqual(["prefer-const"])
    expect(result.diagnostics[0]).toMatchObject({ file, line: 1, col: 5, severity: "warn" })
  })

  test("reports nothing on clean code, so every bundled rule name is valid", async () => {
    const file = join(dir, "x.ts")
    await Bun.write(file, "export const x = 1\n")
    const result = await lintWithBun([file], dir, { fix: false })
    expect(result).toEqual({ tool: "bun", ok: true, diagnostics: [] })
  })

  test("--fix rewrites the file with safe fixes applied", async () => {
    const file = join(dir, "x.ts")
    await Bun.write(file, "let x = 1\nconsole.log(x)\n")
    await lintWithBun([file], dir, { fix: true })
    expect(await Bun.file(file).text()).toContain("const x")
  })

  test("uses a project bunfig.toml [lint] instead of the bundled rules", async () => {
    await Bun.write(
      join(dir, "bunfig.toml"),
      `[lint.categories]\n${["correctness", "suspicious", "pedantic", "style", "nursery", "restriction", "perf"].map((c) => `${c} = "off"`).join("\n")}\n\n[lint.rules]\n"no-console" = "error"\n`,
    )
    const nested = join(dir, "src")
    const file = join(nested, "x.ts")
    await Bun.write(file, "let x = 1\nconsole.log(x)\n")
    const result = await lintWithBun([file], nested, { fix: false })
    expect(result.diagnostics.map((d) => d.code)).toEqual(["no-console"])
  })

  test("reports JSON that does not parse", async () => {
    const file = join(dir, "bad.json")
    await Bun.write(file, '{"a": 1,\n"b": }\n')
    await Bun.write(join(dir, "ok.jsonc"), '// comment\n{"a": 1,}\n')
    const result = await lintWithBun([file, join(dir, "ok.jsonc")], dir, { fix: false })
    expect(result.ok).toBe(false)
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ file, code: "json-syntax-error", severity: "error" }),
    ])
  })

  test("reports a syntax error as an error", async () => {
    const file = join(dir, "x.ts")
    await Bun.write(file, "const = 1\n")
    const result = await lintWithBun([file], dir, { fix: false })
    expect(result.ok).toBe(false)
    expect(result.diagnostics[0]).toMatchObject({
      code: "syntax-error",
      line: 1,
      severity: "error",
    })
  })
})

describe("lintWithBun with other configs and failures", () => {
  test("reads an oxlint config and maps its report", async () => {
    await Bun.write(join(dir, ".oxlintrc.json"), '{ "rules": { "no-debugger": "error" } }\n')
    const file = join(dir, "x.ts")
    await Bun.write(file, "export const x = 1\ndebugger\n")
    const result = await lintWithBun([file], dir, { fix: false })
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ file, line: 2, col: 1, code: "no-debugger", severity: "error" }),
    )
    expect(result.ok).toBe(false)
  })

  test("fails when the project config names a rule bun lint does not have", async () => {
    await Bun.write(
      join(dir, "eslint.config.js"),
      'export default [{ rules: { "made-up-rule": "error" } }]\n',
    )
    const file = join(dir, "x.js")
    await Bun.write(file, "export const x = 1\n")
    const result = await lintWithBun([file], dir, { fix: false })
    expect(result.ok).toBe(false)
    expect(result.diagnostics.some((d) => d.code === "bun" && d.severity === "error")).toBe(true)
  })

  test("reports a bunfig.toml that does not parse instead of throwing", async () => {
    await Bun.write(join(dir, "bunfig.toml"), "[lint\n")
    const file = join(dir, "x.ts")
    await Bun.write(file, "export const x = 1\n")
    const result = await lintWithBun([file], dir, { fix: false })
    expect(result.ok).toBe(false)
    expect(result.diagnostics[0]?.code).toBe("bun")
  })

  test("keeps parsing errors readable when FORCE_COLOR is set", async () => {
    const previous = process.env.FORCE_COLOR
    process.env.FORCE_COLOR = "1"
    try {
      await Bun.write(
        join(dir, "eslint.config.js"),
        "import nope from './missing.js'\nexport default [nope]\n",
      )
      const file = join(dir, "x.js")
      await Bun.write(file, "export const x = 1\n")
      const result = await lintWithBun([file], dir, { fix: false })
      expect(result.ok).toBe(false)
      expect(result.diagnostics.every((d) => !d.message.includes("\u001b"))).toBe(true)
    } finally {
      if (previous === undefined) {
        delete process.env.FORCE_COLOR
      } else {
        process.env.FORCE_COLOR = previous
      }
    }
  })

  test("lints a file whose name starts with a dash", async () => {
    const file = join(dir, "-dash.ts")
    await Bun.write(file, "let x = 1\nconsole.log(x)\n")
    const result = await lintWithBun([file], dir, { fix: false })
    expect(result.diagnostics.map((d) => [d.file, d.code])).toEqual([[file, "prefer-const"]])
  })

  test("rejects trailing commas in .json but allows them in tsconfig.json", async () => {
    const strict = join(dir, "package.json")
    await Bun.write(strict, '{"a": 1,}\n')
    await Bun.write(join(dir, "tsconfig.json"), '{\n  // comment\n  "a": 1,\n}\n')
    const result = await lintWithBun([strict, join(dir, "tsconfig.json")], dir, { fix: false })
    expect(result.diagnostics.map((d) => [d.file, d.code])).toEqual([[strict, "json-syntax-error"]])
  })
})

describe("lintProto", () => {
  test("reports buf findings when the target dir is a relative path", async () => {
    const docs = join(dir, "docs")
    await Bun.write(join(docs, "x.proto"), 'syntax = "proto3";\npackage Bad_pkg;\nmessage m {}\n')
    const report = await lintAll({
      dir: relative(process.cwd(), docs),
      fix: false,
      filter: new Set(["proto"]),
    })
    const proto = report.results.find((r) => r.tool === "proto")
    expect(proto?.ok).toBe(false)
    expect(proto?.diagnostics.map((d) => d.code)).toContain("MESSAGE_PASCAL_CASE")
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
    expect(tools).toContain("bun")
  })

  test("filter restricts dispatch to a single tool", async () => {
    await Bun.write(join(dir, "doc.md"), "# Title\n\n\n\nbody\n")
    await Bun.write(join(dir, "x.ts"), "let x = 1\nconsole.log(x)\n")
    const report = await lintAll({ dir, fix: false, filter: new Set(["md"]) })
    expect(report.results.every((r) => r.tool === "md")).toBe(true)
  })
})
