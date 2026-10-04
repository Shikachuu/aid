import { applyFixes } from "markdownlint"
import type { ToolResult } from "../lint/diagnostics"
import { runMarkdownlint } from "../lint/markdown"
import { applyFormat } from "./apply"

/** Apply markdownlint's fixable rules to the given files. */
export const formatMarkdown = async (
  paths: string[],
  dir: string,
  opts: { check: boolean },
): Promise<ToolResult> => {
  if (paths.length === 0) {
    return { tool: "md", ok: true, diagnostics: [] }
  }
  const results = await runMarkdownlint(paths, dir)
  return applyFormat("md", paths, opts.check, (file, text) => applyFixes(text, results[file] ?? []))
}
