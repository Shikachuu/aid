import { applyFixes } from "markdownlint"
import { lint } from "markdownlint/promise"
import type { ToolResult } from "../lint/diagnostics"
import { resolveMarkdownConfig } from "../lint/markdown"

/**
 * Apply markdownlint fixable rules across the given files.
 * In `--check` mode, no files are written; instead `wouldChange` lists files
 * whose content would differ after auto-fixing.
 */
export const formatMarkdown = async (
  paths: string[],
  dir: string,
  opts: { check: boolean },
): Promise<ToolResult> => {
  if (paths.length === 0) {
    return { tool: "md", ok: true, diagnostics: [] }
  }
  const config = await resolveMarkdownConfig(dir)
  // biome-ignore lint/suspicious/noExplicitAny: markdownlint Configuration type isn't published as a TS type
  const results = await lint({ files: paths, config: config as any })
  const wouldChange: string[] = []
  let ok = true
  for (const [file, errors] of Object.entries(results)) {
    if (!Array.isArray(errors)) {
      continue
    }
    const fixable = errors.filter((e) => e.fixInfo)
    if (fixable.length === 0) {
      continue
    }
    const original = await Bun.file(file).text()
    const fixed = applyFixes(original, fixable)
    if (fixed === original) {
      continue
    }
    if (opts.check) {
      wouldChange.push(file)
      ok = false
    } else {
      await Bun.write(file, fixed)
    }
  }
  return { tool: "md", ok, diagnostics: [], wouldChange: opts.check ? wouldChange : undefined }
}
