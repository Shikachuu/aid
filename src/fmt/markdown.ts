import type { ToolResult } from "../lint/diagnostics"
import { fixMarkdown, resolveMarkdownConfig } from "../lint/markdown"
import { applyFormat } from "./apply"

/** Backs `aid fmt` for markdown. It shares lint's config and fixes, so fmt only rewrites what lint reports. */
export const formatMarkdown = async (
  paths: string[],
  dir: string,
  opts: { check: boolean },
): Promise<ToolResult> => {
  if (paths.length === 0) {
    return { tool: "md", ok: true, diagnostics: [] }
  }
  const resolved = await resolveMarkdownConfig(dir)
  if ("error" in resolved) {
    return { tool: "md", ok: false, diagnostics: [resolved.error] }
  }
  const { config } = resolved
  const fixed = new Map<string, string>()
  for (const file of paths) {
    fixed.set(file, (await fixMarkdown(file, await Bun.file(file).text(), config)).text)
  }
  return applyFormat("md", paths, opts.check, (file, text) => fixed.get(file) ?? text)
}
