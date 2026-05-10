/** Severity levels surfaced by the unified diagnostic format. */
export type Severity = "error" | "warn" | "info"

/** A single lint or fmt diagnostic in `aid`'s normalized shape. */
export type Diagnostic = {
  file: string
  line?: number
  col?: number
  severity: Severity
  code: string
  message: string
}

/** Tools that the lint/fmt orchestrator can dispatch to. */
export type Tool = "md" | "openapi" | "biome" | "proto"

/** The result of running one tool over its discovered files. */
export type ToolResult = {
  tool: Tool
  ok: boolean
  diagnostics: Diagnostic[]
  /** True if the tool was supposed to run but couldn't (e.g. buf binary missing). */
  skipped?: boolean
  /** Human-readable reason a tool was skipped. */
  reason?: string
  /** Files that would change in `--check` mode (fmt only). */
  wouldChange?: string[]
}

const ANSI = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  bold: "\x1b[1m",
} as const

const useColor = () => process.stdout.isTTY === true

const colorize = (s: string, code: keyof typeof ANSI): string =>
  useColor() ? `${ANSI[code]}${s}${ANSI.reset}` : s

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
      if (d.severity === "error") errors++
      else if (d.severity === "warn") warnings++
      else infos++
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
