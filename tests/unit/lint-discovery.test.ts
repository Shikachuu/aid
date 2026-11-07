import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"
import { chmodSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { printReport, renderPretty, type ToolResult } from "../../src/lint/diagnostics"
import { listFiles } from "../../src/lint/discovery"
import { lintAll } from "../../src/lint/orchestrate"

let dir: string

const result = (r: Partial<ToolResult> & Pick<ToolResult, "tool">): ToolResult => ({
  ok: true,
  diagnostics: [],
  ...r,
})

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "aid-discovery-"))
})

afterEach(() => {
  chmodSync(dir, 0o755)
  rmSync(dir, { recursive: true, force: true })
})

describe("discovery", () => {
  test("walks dot directories but not the ignored ones", async () => {
    for (const rel of [
      ".github/CONTRIBUTING.md",
      ".vscode/settings.json",
      ".oxlintrc.json",
      "docs/index.md",
      ".git/x.md",
      ".aid/out.md",
      "node_modules/pkg/README.md",
      "docs/dist/x.md",
    ]) {
      await Bun.write(join(dir, rel), "# Title\n")
    }
    expect((await listFiles(dir)).files).toEqual([
      ".github/CONTRIBUTING.md",
      ".oxlintrc.json",
      ".vscode/settings.json",
      "docs/index.md",
    ])
  })

  test.skipIf(process.getuid?.() === 0)(
    "reports a directory it cannot read and lints the rest",
    async () => {
      await Bun.write(join(dir, "ok", "doc.md"), "# Title\n\n\nbody\n")
      const locked = join(dir, "locked")
      await Bun.write(join(locked, "doc.md"), "# Title\n")
      chmodSync(locked, 0o000)
      try {
        const report = await lintAll({ dir, fix: false, filter: new Set(["md", "css"]) })
        const md = report.results.find((r) => r.tool === "md")
        expect(md?.diagnostics.map((d) => [d.code, d.severity, d.file])).toEqual([
          ["read-error", "warn", locked],
          ["MD012", "error", join(dir, "ok", "doc.md")],
        ])
        expect(report.results.find((r) => r.tool === "css")?.diagnostics).toEqual([])
      } finally {
        chmodSync(locked, 0o755)
      }
    },
  )

  test("throws a one-line aid error for a directory that does not exist", async () => {
    const missing = join(dir, "missing")
    expect(lintAll({ dir: missing, fix: false, filter: null })).rejects.toThrow(
      `aid: cannot read directory ${missing} (ENOENT)`,
    )
  })
})

describe("renderPretty", () => {
  test("prints each location shape, severity and the per-tool summary", () => {
    const out = renderPretty([
      result({
        tool: "md",
        diagnostics: [
          { file: "a.md", line: 2, col: 3, severity: "error", code: "MD001", message: "m1" },
          { file: "b.md", line: 4, severity: "warn", code: "MD002", message: "m2" },
          { file: "c.md", severity: "info", code: "MD003", message: "m3" },
        ],
      }),
      result({ tool: "bun", wouldChange: ["x.ts", "y.ts"] }),
    ])
    expect(out.split("\n")).toEqual([
      "a.md:2:3  error  MD001  m1",
      "b.md:4  warn   MD002  m2",
      "c.md  info   MD003  m3",
      "x.ts  would-change  bun/format  file would be reformatted",
      "y.ts  would-change  bun/format  file would be reformatted",
      "",
      "1 error, 3 warnings, 1 info (md 3, bun 2)",
    ])
  })

  test("prints skipped tools with and without a reason, and their diagnostics", () => {
    const out = renderPretty([
      result({ tool: "proto", skipped: true, reason: "no buf" }),
      result({
        tool: "css",
        skipped: true,
        diagnostics: [{ file: "d", severity: "warn", code: "read-error", message: "skipped" }],
      }),
    ])
    expect(out.split("\n")).toEqual([
      "proto: skipped (no buf)",
      "css: skipped",
      "d  warn   read-error  skipped",
      "",
      "0 errors, 1 warning (proto 0, css 1)",
    ])
  })
})

describe("printReport", () => {
  test.each([
    [true, 0],
    [false, 1],
  ])("exits with the report status (ok: %p)", (ok, code) => {
    const write = spyOn(process.stdout, "write").mockImplementation(() => true)
    const exit = spyOn(process, "exit").mockImplementation((() => undefined) as never)
    try {
      printReport({ ok, results: [result({ tool: "md" })] }, "json")
      expect(JSON.parse(String(write.mock.calls[0]?.[0]))).toEqual({
        results: [{ tool: "md", ok: true, diagnostics: [] }],
      })
      expect(exit).toHaveBeenCalledWith(code)
    } finally {
      write.mockRestore()
      exit.mockRestore()
    }
  })
})
