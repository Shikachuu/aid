/** Only `error` fails a tool; pretty output colors and counts each severity. */
export type Severity = "error" | "warn" | "info"

/** One finding from any lint or format tool, with a 1-based `line` and `col`, so both reporters print every tool the same way. */
export type Diagnostic = {
  file: string
  line?: number
  col?: number
  severity: Severity
  code: string
  message: string
}

/** Every tool `aid lint` knows, in the order the report lists them. */
export const KNOWN_TOOLS = ["md", "openapi", "bun", "css", "proto"] as const

/** Any name outside {@link KNOWN_TOOLS} makes `--filter` a usage error. */
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

/**
 * One error for a subprocess that failed without output aid could parse. It
 * keeps the last lines of stderr, or stdout when stderr is empty, so the user
 * sees why the tool failed.
 */
export const processFailure = (
  tool: string,
  run: { stdout: string; stderr: string; exitCode: number },
  file: string,
  code: string,
): Diagnostic => {
  const detail = (run.stderr.trim() || run.stdout.trim()).split("\n").slice(-5).join(" ")
  return {
    file,
    severity: "error",
    code,
    message: `${tool} exited with code ${run.exitCode}${detail === "" ? "" : `: ${detail}`}`,
  }
}

/** Aggregate result of a lint or fmt run; `ok` is false when any tool failed. */
export type Report = { ok: boolean; results: ToolResult[] }

/**
 * Parse a `--filter` value such as `md,bun` into a tool set, or `null` to run
 * every tool when no filter is given. Throws on a name outside `allowed`, so a
 * typo never widens a run that rewrites files.
 */
export const parseFilter = (
  raw: string | undefined,
  allowed: readonly Tool[] = KNOWN_TOOLS,
): Set<Tool> | null => {
  if (raw === undefined) {
    return null
  }
  const names = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "")
  if (names.length === 0) {
    throw new Error(`aid: --filter needs at least one tool. Choose from: ${allowed.join(", ")}.`)
  }
  const unknown = names.filter((name) => !(allowed as readonly string[]).includes(name))
  if (unknown.length > 0) {
    throw new Error(
      `aid: unknown --filter ${unknown.length === 1 ? "tool" : "tools"} ${unknown.join(", ")}. Choose from: ${allowed.join(", ")}.`,
    )
  }
  return new Set(names as Tool[])
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

/** The default report. A `--check` would-change file counts as a warning in the summary. */
export const renderPretty = (results: ToolResult[]): string => {
  const lines: string[] = []
  let errors = 0
  let warnings = 0
  let infos = 0
  const perTool = new Map<Tool, number>(results.map((r) => [r.tool, 0]))

  for (const r of results) {
    if (r.skipped) {
      lines.push(colorize(`${r.tool}: skipped${r.reason ? ` (${r.reason})` : ""}`, "dim"))
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
      perTool.set(r.tool, (perTool.get(r.tool) ?? 0) + 1)
    }
    if (r.wouldChange && r.wouldChange.length > 0) {
      for (const f of r.wouldChange) {
        lines.push(
          `${f}  ${colorize("would-change", "yellow")}  ${colorize(`${r.tool}/format`, "bold")}  file would be reformatted`,
        )
        warnings++
        perTool.set(r.tool, (perTool.get(r.tool) ?? 0) + 1)
      }
    }
  }

  const summary = `${errors} error${errors === 1 ? "" : "s"}, ${warnings} warning${warnings === 1 ? "" : "s"}${infos > 0 ? `, ${infos} info` : ""} (${[...perTool].map(([tool, n]) => `${tool} ${n}`).join(", ")})`
  lines.push("")
  lines.push(colorize(summary, errors > 0 ? "red" : warnings > 0 ? "yellow" : "dim"))
  return lines.join("\n")
}

/** For scripts: every `ToolResult` as is, skipped tools and would-change lists included. */
export const renderJson = (results: ToolResult[]): string => JSON.stringify({ results }, null, 2)

/** Write `report` to stdout as `pretty` or `json`, then exit 0 when it passed and 1 otherwise. */
export const printReport = (report: Report, format: string): never => {
  const out = format === "json" ? renderJson(report.results) : renderPretty(report.results)
  process.stdout.write(`${out}\n`)
  process.exit(report.ok ? 0 : 1)
}
