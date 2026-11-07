import { applyFixes, type Configuration, type LintError } from "markdownlint"
import { lint, readConfig } from "markdownlint/promise"
import { findUserConfig } from "./config-resolve"
import { markdownlintDefault } from "./configs/markdownlint.default"
import type { Diagnostic, ToolResult } from "./diagnostics"
import { USER_CONFIGS } from "./discovery"

const CONFIG_PARSERS = [Bun.JSONC.parse, Bun.YAML.parse] as ((text: string) => Configuration)[]

/**
 * Shared by `aid lint` and `aid fmt`, so both apply the same markdown rules.
 * markdownlint reads the user's config, so `extends` resolves; a config that
 * does not parse comes back as an error diagnostic instead of a crash.
 */
export const resolveMarkdownConfig = async (
  dir: string,
): Promise<{ config: Configuration } | { error: Diagnostic }> => {
  const path = await findUserConfig(dir, USER_CONFIGS.md)
  if (path === null) {
    return { config: markdownlintDefault }
  }
  try {
    return { config: await readConfig(path, CONFIG_PARSERS) }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    return {
      error: {
        file: path,
        severity: "error",
        code: "md/config",
        message: `cannot read config: ${detail}`,
      },
    }
  }
}

const MEANING_CHANGING_RULES = new Set(["MD037", "MD053"])

const removesHardBreak = (error: LintError, lines: string[]): boolean =>
  error.ruleNames[0] === "MD009" && isHardBreak(lines[error.lineNumber - 1] ?? "")

const isHardBreak = (line: string): boolean => line.trim() !== "" && / {2,}$/.test(line)

const isSafeFix = (error: LintError, lines: string[]): boolean => {
  if (error.fixInfo === undefined || error.fixInfo === null) {
    return false
  }
  const rule = error.ruleNames[0] ?? ""
  if (MEANING_CHANGING_RULES.has(rule)) {
    return false
  }
  return !removesHardBreak(error, lines)
}

const MAX_FIX_PASSES = 3

/**
 * Apply the safe fixes to `text` until nothing changes, so a fix that exposes
 * another fixable violation is handled in the same run. Returns the fixed text
 * and the violations that remain.
 */
export const fixMarkdown = async (
  file: string,
  text: string,
  config: Configuration,
): Promise<{ text: string; remaining: LintError[] }> => {
  let current = text
  for (let pass = 0; ; pass++) {
    const results = await lint({ strings: { [file]: current }, config })
    const errors = results[file] ?? []
    const lines = current.split(/\r?\n/)
    const safe = errors.filter((e) => isSafeFix(e, lines))
    if (safe.length === 0 || pass === MAX_FIX_PASSES) {
      return { text: current, remaining: errors }
    }
    const fixed = applyFixes(current, safe)
    if (fixed === current) {
      return { text: current, remaining: errors }
    }
    current = fixed
  }
}

const toDiagnostic = (file: string, e: LintError): Diagnostic => ({
  file,
  line: e.lineNumber,
  col: e.errorRange?.[0],
  severity: e.severity === "warning" ? "warn" : "error",
  code: e.ruleNames[0] ?? "markdownlint",
  message: e.errorDetail ? `${e.ruleDescription}: ${e.errorDetail}` : e.ruleDescription,
})

/** With `opts.fix`, write the safe fixes back to disk and report what remains after re-linting the fixed text. */
export const lintMarkdown = async (
  paths: string[],
  dir: string,
  opts: { fix: boolean } = { fix: false },
): Promise<ToolResult> => {
  if (paths.length === 0) {
    return { tool: "md", ok: true, diagnostics: [] }
  }
  const resolved = await resolveMarkdownConfig(dir)
  if ("error" in resolved) {
    return { tool: "md", ok: false, diagnostics: [resolved.error] }
  }
  const { config } = resolved
  const results = await lint({ files: paths, config })
  const diagnostics: Diagnostic[] = []
  for (const [file, errors] of Object.entries(results)) {
    let remaining = errors
    if (opts.fix && errors.some((e) => e.fixInfo)) {
      const original = await Bun.file(file).text()
      const fixed = await fixMarkdown(file, original, config)
      if (fixed.text !== original) {
        await Bun.write(file, fixed.text)
      }
      remaining = fixed.remaining
    }
    diagnostics.push(...remaining.map((e) => toDiagnostic(file, e)))
  }
  return { tool: "md", ok: diagnostics.every((d) => d.severity !== "error"), diagnostics }
}
