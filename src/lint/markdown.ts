import { applyFixes, type Configuration, type LintResults } from "markdownlint"
import { lint } from "markdownlint/promise"
import { findUserConfig, parseConfigFile } from "./config-resolve"
import { markdownlintDefault } from "./configs/markdownlint.default"
import type { Diagnostic, ToolResult } from "./diagnostics"
import { USER_CONFIGS } from "./discovery"

const resolveMarkdownConfig = async (dir: string): Promise<Configuration> => {
  const path = await findUserConfig(dir, USER_CONFIGS.md)
  return path === null ? markdownlintDefault : ((await parseConfigFile(path)) as Configuration)
}

/** Run markdownlint over `paths` with the user's `.markdownlint.*` config, or the bundled default. */
export const runMarkdownlint = async (paths: string[], dir: string): Promise<LintResults> =>
  lint({ files: paths, config: await resolveMarkdownConfig(dir) })

/**
 * Lint markdown files. With `opts.fix`, write the fixable violations back to
 * disk and report only the violations that remain.
 */
export const lintMarkdown = async (
  paths: string[],
  dir: string,
  opts: { fix: boolean } = { fix: false },
): Promise<ToolResult> => {
  if (paths.length === 0) {
    return { tool: "md", ok: true, diagnostics: [] }
  }
  const results = await runMarkdownlint(paths, dir)
  const diagnostics: Diagnostic[] = []
  let ok = true
  for (const [file, errors] of Object.entries(results)) {
    let remaining = errors
    if (opts.fix && errors.some((e) => e.fixInfo)) {
      const original = await Bun.file(file).text()
      const fixed = applyFixes(original, errors)
      if (fixed !== original) {
        await Bun.write(file, fixed)
      }
      remaining = errors.filter((e) => !e.fixInfo)
    }
    for (const e of remaining) {
      const sev = e.severity === "warning" ? "warn" : "error"
      if (sev === "error") {
        ok = false
      }
      diagnostics.push({
        file,
        line: e.lineNumber,
        col: e.errorRange?.[0],
        severity: sev,
        code: e.ruleNames[0] ?? "markdownlint",
        message: e.errorDetail ? `${e.ruleDescription}: ${e.errorDetail}` : e.ruleDescription,
      })
    }
  }
  return { tool: "md", ok, diagnostics }
}
