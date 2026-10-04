/** Severity shared by every tool. Pretty output colors and counts by it. */
export type Severity = "error" | "warn" | "info"

/** One finding from markdownlint, Spectral, Biome or buf, normalized so both reporters print every tool the same way. */
export type Diagnostic = {
  file: string
  line?: number
  col?: number
  severity: Severity
  code: string
  message: string
}

/** Tools that `aid lint` and `aid fmt` dispatch to, in report order. */
export const KNOWN_TOOLS = ["md", "openapi", "biome", "proto"] as const

/** Tool name as accepted by `--filter` and printed in reports. */
export type Tool = (typeof KNOWN_TOOLS)[number]

/** Outcome of one tool's run. A single `ok: false` fails the whole report. */
export type ToolResult = {
  tool: Tool
  ok: boolean
  diagnostics: Diagnostic[]
  /** True when the tool had files to check but could not run, for example without a `buf` binary. */
  skipped?: boolean
  reason?: string
  /** Files that would change in `--check` mode (fmt only). */
  wouldChange?: string[]
}

/** Aggregate result of a lint or fmt run; `ok` is false when any tool failed. */
export type Report = { ok: boolean; results: ToolResult[] }

/**
 * Parse a `--filter` value such as `md,biome` into a tool set. Unknown names
 * are dropped; `null` (run every tool) is returned when nothing valid remains.
 */
export const parseFilter = (raw: string | undefined): Set<Tool> | null => {
  const tools = (raw ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter((part): part is Tool => (KNOWN_TOOLS as readonly string[]).includes(part))
  return tools.length === 0 ? null : new Set(tools)
}

const ANSI = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  bold: "\x1b[1m",
} as const

const colorEnabled = () => process.stdout.isTTY === true

const colorize = (s: string, code: keyof typeof ANSI): string =>
  colorEnabled() ? `${ANSI[code]}${s}${ANSI.reset}` : s

const severityColor = (s: Severity): keyof typeof ANSI =>
  s === "error" ? "red" : s === "warn" ? "yellow" : "blue"

/**
 * Render a list of tool results as human-friendly text.
 * Used by `aid lint` and `aid fmt` when `--format=pretty` (the default).
 */
export const renderPretty = (results: ToolResult[]): string => {
  const lines: string[] = []
  let errors = 0
  let warnings = 0
  let infos = 0
  const perTool: Record<Tool, number> = { md: 0, openapi: 0, biome: 0, proto: 0 }

  for (const r of results) {
    if (r.skipped) {
      lines.push(colorize(`${r.tool}: skipped${r.reason ? ` (${r.reason})` : ""}`, "dim"))
      continue
    }
    for (const d of r.diagnostics) {
      const loc =
        d.line === undefined
          ? d.file
          : d.col === undefined
            ? `${d.file}:${d.line}`
            : `${d.file}:${d.line}:${d.col}`
      const sev = colorize(d.severity.padEnd(5), severityColor(d.severity))
      lines.push(`${loc}  ${sev}  ${colorize(d.code, "bold")}  ${d.message}`)
      if (d.severity === "error") {
        errors++
      } else if (d.severity === "warn") {
        warnings++
      } else {
        infos++
      }
      perTool[r.tool]++
    }
    if (r.wouldChange && r.wouldChange.length > 0) {
      for (const f of r.wouldChange) {
        lines.push(
          `${f}  ${colorize("would-change", "yellow")}  ${colorize(`${r.tool}/format`, "bold")}  file would be reformatted`,
        )
        warnings++
        perTool[r.tool]++
      }
    }
  }

  const summary = `${errors} error${errors === 1 ? "" : "s"}, ${warnings} warning${warnings === 1 ? "" : "s"}${infos > 0 ? `, ${infos} info` : ""} (md ${perTool.md}, openapi ${perTool.openapi}, biome ${perTool.biome}, proto ${perTool.proto})`
  lines.push("")
  lines.push(colorize(summary, errors > 0 ? "red" : warnings > 0 ? "yellow" : "dim"))
  return lines.join("\n")
}

/** Render results as JSON for piping into other tools or CI parsers. */
export const renderJson = (results: ToolResult[]): string => JSON.stringify({ results }, null, 2)

/** Write `report` to stdout as `pretty` or `json`, then exit 0 when it passed and 1 otherwise. */
export const printReport = (report: Report, format: string): never => {
  const out = format === "json" ? renderJson(report.results) : renderPretty(report.results)
  process.stdout.write(`${out}\n`)
  process.exit(report.ok ? 0 : 1)
}
