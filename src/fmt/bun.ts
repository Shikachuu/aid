import { resolve } from "node:path"
import { argPath, batches, configArgs, dedupe, runBun, stderrDiagnostics } from "../lint/bun"
import { type Diagnostic, processFailure, type ToolResult } from "../lint/diagnostics"

// `bun fmt --check` lists each file on its own line: a bare path on stdout with a
// bunfig `[fmt]` section (aid's bundled default), `[warn] b.js` on stderr with a
// Prettier config, and `b.js (1ms)` with an oxfmt config.
const listedPath = (line: string): string =>
  line
    .trim()
    .replace(/^\[warn\]\s+/, "")
    .replace(/\s+\(\d+(\.\d+)?m?s\)$/, "")

/**
 * Format JS, TS, JSON and CSS files with `bun fmt`. In `check` mode nothing is
 * written; the files `bun fmt` would change land in `wouldChange`.
 */
export const formatWithBun = async (
  paths: string[],
  dir: string,
  opts: { check: boolean },
): Promise<ToolResult> => {
  if (paths.length === 0) {
    return { tool: "bun", ok: true, diagnostics: [] }
  }
  const config = await configArgs(dir, "fmt")
  const wanted = new Set(paths.map((p) => resolve(p)))
  const wouldChange: string[] = []
  const diagnostics: Diagnostic[] = []
  for (const batch of batches(paths.map((p) => argPath(dir, p)))) {
    const check = opts.check ? ["--check"] : []
    const run = await runBun([...config, "fmt", "--no-script", ...check, ...batch], dir)
    const errors = stderrDiagnostics(run.stderr, dir, "bun/format")
    diagnostics.push(...errors)
    const listed = opts.check
      ? `${run.stdout}\n${run.stderr}`
          .split("\n")
          .map((line) => resolve(dir, listedPath(line)))
          .filter((file) => wanted.has(file))
      : []
    wouldChange.push(...listed)
    const explained = errors.length > 0 || listed.length > 0
    if (run.exitCode !== 0 && !explained) {
      diagnostics.push(processFailure("bun", run, dir, "bun/format"))
    }
  }
  const unique = dedupe(diagnostics)
  return {
    tool: "bun",
    ok: wouldChange.length === 0 && unique.length === 0,
    diagnostics: unique,
    wouldChange: opts.check ? [...new Set(wouldChange)] : undefined,
  }
}
