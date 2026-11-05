import type { Diagnostic, Tool, ToolResult } from "../lint/diagnostics"
import { readSource, writeSource } from "../lint/source-file"

/**
 * Run `transform` over each file. Changed output is written back, or, in
 * `check` mode, listed in `wouldChange` and the result fails. A file that
 * cannot be read is skipped with a `read-error` warning.
 */
export const applyFormat = async (
  tool: Tool,
  paths: string[],
  check: boolean,
  transform: (file: string, text: string) => string | Promise<string>,
): Promise<ToolResult> => {
  const wouldChange: string[] = []
  const diagnostics: Diagnostic[] = []
  for (const file of paths) {
    const source = await readSource(file)
    if ("severity" in source) {
      diagnostics.push(source)
      continue
    }
    const formatted = await transform(file, source.text)
    if (formatted === source.text) {
      continue
    }
    if (check) {
      wouldChange.push(file)
    } else {
      await writeSource(file, { ...source, text: formatted })
    }
  }
  return {
    tool,
    ok: wouldChange.length === 0,
    diagnostics,
    wouldChange: check ? wouldChange : undefined,
  }
}
