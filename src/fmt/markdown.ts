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
  return applyFormat(
    "md",
    paths,
    opts.check,
    async (file, text) => (await fixMarkdown(file, text, config)).text,
  )
}
