import { applyFixes } from "markdownlint"
import { lint } from "markdownlint/promise"
import { findUserConfig, parseConfigFile } from "./config-resolve"
import { markdownlintDefault } from "./configs/markdownlint.default"
import type { Diagnostic, ToolResult } from "./diagnostics"

const USER_CONFIGS = [
  ".markdownlint.json",
  ".markdownlint.jsonc",
  ".markdownlint.yaml",
  ".markdownlint.yml",
] as const

/** Return the user's `.markdownlint.*` config object, or the baked-in default. */
export const resolveMarkdownConfig = async (dir: string): Promise<unknown> => {
  const path = await findUserConfig(dir, USER_CONFIGS)
  if (path === null) return markdownlintDefault
  const parsed = await parseConfigFile(path)
  if (parsed && typeof parsed === "object" && "config" in parsed) {
    return (parsed as { config: unknown }).config ?? parsed
  }
  return parsed
}

/**
 * Lint markdown files via `markdownlint/promise`. When `opts.fix` is true,
 * also write back fixable rule violations and exclude them from the returned
 * diagnostics.
 */
export const lintMarkdown = async (
  paths: string[],
  dir: string,
  opts: { fix: boolean } = { fix: false },
): Promise<ToolResult> => {
  if (paths.length === 0) return { tool: "md", ok: true, diagnostics: [] }
  const config = await resolveMarkdownConfig(dir)
  // biome-ignore lint/suspicious/noExplicitAny: markdownlint Configuration type isn't published as a TS type
  const results = await lint({ files: paths, config: config as any })
  const diagnostics: Diagnostic[] = []
  let ok = true
  for (const [file, errors] of Object.entries(results)) {
    if (!Array.isArray(errors)) continue
    let remaining = errors
    if (opts.fix) {
      const fixable = errors.filter((e) => e.fixInfo)
      if (fixable.length > 0) {
        const original = await Bun.file(file).text()
        const fixed = applyFixes(original, fixable)
        if (fixed !== original) await Bun.write(file, fixed)
        remaining = errors.filter((e) => !e.fixInfo)
      }
    }
    for (const e of remaining) {
      const sev = e.severity === "warning" ? "warn" : "error"
      if (sev === "error") ok = false
      const ruleCode = e.ruleNames[0] ?? "markdownlint"
      diagnostics.push({
        file,
        line: e.lineNumber,
        col: e.errorRange?.[0],
        severity: sev,
        code: ruleCode,
        message: e.errorDetail ? `${e.ruleDescription}: ${e.errorDetail}` : e.ruleDescription,
      })
    }
  }
  return { tool: "md", ok, diagnostics }
}
