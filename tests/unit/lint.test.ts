import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { lintProto } from "../../src/lint/proto"
import { chmodSync, mkdtempSync, rmSync } from "node:fs"
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

  test("--fix keeps a hard line break but strips spaces on a blank line", async () => {
    const file = join(dir, "doc.md")
    await Bun.write(file, "# Title\n\nline one   \nline\t  \nline two\n\t  \nend\n")
    await lintMarkdown([file], dir, { fix: true })
    expect(await Bun.file(file).text()).toBe("# Title\n\nline one   \nline   \nline two\n\nend\n")
  })

  test("resolves extends in a user config", async () => {
    await Bun.write(join(dir, "base.yaml"), "MD012: false\n")
    await Bun.write(
      join(dir, ".markdownlint.jsonc"),
      '{\n  // shared rules\n  "extends": "base.yaml"\n}\n',
    )
    const file = join(dir, "doc.md")
    await Bun.write(file, "# Title\n\n\n\nbody\n")
    const result = await lintMarkdown([file], dir)
    expect(result).toEqual({ tool: "md", ok: true, diagnostics: [] })
  })

  test.each([
    [".markdownlint.json", '{"MD012": '],
    [".markdownlint.yaml", "MD012: [\n"],
    [".markdownlint.json", '{"extends": "missing.json"}'],
  ])("reports a %s that cannot be read instead of throwing", async (name, text) => {
    const config = join(dir, name)
    await Bun.write(config, text)
    const file = join(dir, "doc.md")
    await Bun.write(file, "# Title\n")
    const result = await lintMarkdown([file], dir)
    expect(result.ok).toBe(false)
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ file: config, severity: "error", code: "md/config" }),
    ])
  })

  test("reports a file that vanished since discovery and lints the rest", async () => {
    const gone = join(dir, "gone.md")
    const file = join(dir, "doc.md")
    await Bun.write(file, "# Title\n\n\nbody\n")
    const result = await lintMarkdown([gone, file], dir)
    expect(result.diagnostics.map((d) => [d.file, d.code, d.severity])).toEqual([
      [gone, "read-error", "warn"],
      [file, "MD012", "error"],
    ])
  })

  test("--fix keeps a byte order mark", async () => {
    const file = join(dir, "doc.md")
    await Bun.write(file, "\uFEFF# Title\n\n\nbody\n")
    await lintMarkdown([file], dir, { fix: true })
    const bytes = await Bun.file(file).bytes()
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    expect(new TextDecoder().decode(bytes)).toBe("# Title\n\nbody\n")
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

describe("lintOpenApi with a $ref", () => {
  test("attributes a finding in a referenced file to that file and line", async () => {
    const root = join(dir, "openapi", "api.yaml")
    const resp = join(dir, "openapi", "resp.yaml")
    await Bun.write(
      root,
      'openapi: 3.1.0\ninfo:\n  title: T\n  version: "1"\npaths:\n  /a:\n    get:\n      responses:\n        "200":\n          $ref: "./resp.yaml"\n',
    )
    await Bun.write(
      resp,
      "description: ok\ncontent:\n  application/json:\n    schema:\n      type: string\n      enum: [a, a]\n",
    )
    const result = await lintOpenApi([root], dir)
    const finding = result.diagnostics.find((d) => d.code === "duplicated-entry-in-enum")
    expect(finding).toMatchObject({ file: resp, line: 6 })
  })

  test("reports a .spectral.yaml that does not parse instead of throwing", async () => {
    const config = join(dir, ".spectral.yaml")
    await Bun.write(config, "rules: [\n")
    const spec = join(dir, "openapi.yaml")
    await Bun.write(spec, 'openapi: 3.1.0\ninfo:\n  title: T\n  version: "1"\npaths: {}\n')
    const result = await lintOpenApi([spec], dir)
    expect(result.ok).toBe(false)
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ file: config, code: "openapi/config" }),
    ])
  })
})

describe("lintOpenApi with a .spectral.yaml", () => {
  const spec = 'openapi: 3.1.0\ninfo:\n  title: T\n  version: "1"\npaths: {}\n'

  test("resolves extends: spectral:oas and its rule overrides", async () => {
    await Bun.write(
      join(dir, ".spectral.yaml"),
      "extends: [[spectral:oas, recommended]]\nrules:\n  info-description: off\n",
    )
    const file = join(dir, "openapi.yaml")
    await Bun.write(file, spec)
    const codes = (await lintOpenApi([file], dir)).diagnostics.map((d) => d.code)
    expect(codes).toContain("oas3-api-servers")
    expect(codes).not.toContain("info-description")
  })

  test("reports a ruleset Spectral rejects with Spectral's reason", async () => {
    const config = join(dir, ".spectral.yaml")
    await Bun.write(
      config,
      "rules:\n  r:\n    given: $.info\n    then:\n      field: contact\n      function: truthy\n",
    )
    const file = join(dir, "openapi.yaml")
    await Bun.write(file, spec)
    expect(await lintOpenApi([file], dir)).toEqual({
      tool: "openapi",
      ok: false,
      diagnostics: [
        expect.objectContaining({
          file: config,
          code: "openapi/config",
          message: "cannot read config: Function is not defined",
        }),
      ],
    })
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

  test.each(["turbo.json", "biome.json", "deno.json"])(
    "allows comments in %s, which its tool reads as JSONC",
    async (name) => {
      const file = join(dir, name)
      await Bun.write(file, '{\n  // comment\n  "a": 1,\n}\n')
      expect((await lintWithBun([file], dir, { fix: false })).diagnostics).toEqual([])
    },
  )
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
  test("turns a buf failure with no findings into an error that carries buf's message", async () => {
    await Bun.write(join(dir, "buf.yaml"), "version: bogus\n")
    await Bun.write(join(dir, "x.proto"), 'syntax = "proto3";\npackage ok.v1;\n')
    const result = await lintProto([join(dir, "x.proto")], dir)
    expect(result.ok).toBe(false)
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        severity: "error",
        code: "proto/lint",
        message: expect.stringContaining("bogus"),
      }),
    ])
  })
})

describe("lintProto targets", () => {
  test("lints only discovered files, so ignored dirs never reach buf", async () => {
    const bad = 'syntax = "proto3";\npackage Bad_pkg;\nmessage m {}\n'
    await Bun.write(join(dir, "node_modules", "dep", "dep.proto"), bad)
    await Bun.write(join(dir, "dist", "out.proto"), bad)
    await Bun.write(join(dir, "api", "v1", "ok.proto"), 'syntax = "proto3";\npackage api.v1;\n')
    const report = await lintAll({ dir, fix: false, filter: new Set(["proto"]) })
    expect(report.results).toEqual([{ tool: "proto", ok: true, diagnostics: [] }])
  })

  test("passes when the project's buf.yaml excludes every discovered file", async () => {
    await Bun.write(
      join(dir, "buf.yaml"),
      "version: v2\nmodules:\n  - path: .\n    excludes: [gen]\n",
    )
    const file = join(dir, "gen", "x.proto")
    await Bun.write(file, 'syntax = "proto3";\npackage Bad_pkg;\nmessage m {}\n')
    expect(await lintProto([file], dir)).toEqual({ tool: "proto", ok: true, diagnostics: [] })
  })

  test("is skipped, not failed, when no buf binary is available", async () => {
    const file = join(dir, "x.proto")
    await Bun.write(file, 'syntax = "proto3";\n')
    const result = await lintProto([file], dir, async () => null)
    expect(result).toMatchObject({ tool: "proto", ok: true, skipped: true })
  })

  test("splits a long target list across buf runs to stay under the argument limit", async () => {
    const log = join(dir, "calls.log")
    const fakeBuf = join(dir, "fake-buf")
    await Bun.write(fakeBuf, `#!/bin/sh\necho $# >> "${log}"\n`)
    chmodSync(fakeBuf, 0o755)
    const paths = Array.from({ length: 1001 }, (_, i) => join(dir, `p${i}.proto`))
    const result = await lintProto(paths, dir, async () => fakeBuf)
    expect(result).toEqual({ tool: "proto", ok: true, diagnostics: [] })
    const pathArgs = (await Bun.file(log).text())
      .trim()
      .split("\n")
      .map((argc) => Number(argc) - 5)
    expect(pathArgs).toEqual([500, 500, 1])
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
