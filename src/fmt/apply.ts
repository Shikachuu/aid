import type { Tool, ToolResult } from "../lint/diagnostics"

/**
 * Run `transform` over each file. Changed output is written back, or, in
 * `check` mode, listed in `wouldChange` and the result fails.
 */
export const applyFormat = async (
  tool: Tool,
  paths: string[],
  check: boolean,
  transform: (file: string, text: string) => string,
): Promise<ToolResult> => {
  const wouldChange: string[] = []
  for (const file of paths) {
    const original = await Bun.file(file).text()
    const formatted = transform(file, original)
    if (formatted === original) {
      continue
    }
    if (check) {
      wouldChange.push(file)
    } else {
      await Bun.write(file, formatted)
    }
  }
  return {
    tool,
    ok: wouldChange.length === 0,
    diagnostics: [],
    wouldChange: check ? wouldChange : undefined,
  }
}
