import type { ToolResult } from "../lint/diagnostics"
import { fixMarkdown, resolveMarkdownConfig } from "../lint/markdown"
import { applyFormat } from "./apply"

/** Apply markdownlint's safe fixes, with the same config resolution as `aid lint`. */
export const formatMarkdown = async (
  paths: string[],
  dir: string,
  opts: { check: boolean },
): Promise<ToolResult> => {
  if (paths.length === 0) {
    return { tool: "md", ok: true, diagnostics: [] }
  }
  const config = await resolveMarkdownConfig(dir)
  const fixed = new Map<string, string>()
  for (const file of paths) {
    fixed.set(file, (await fixMarkdown(file, await Bun.file(file).text(), config)).text)
  }
  return applyFormat("md", paths, opts.check, (file, text) => fixed.get(file) ?? text)
}
