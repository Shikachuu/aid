import { withBiome } from "../lint/biome"
import type { ToolResult } from "../lint/diagnostics"
import { applyFormat } from "./apply"

/** Format CSS, JSON, JS and TS files through Biome's WASM API. */
export const formatWithBiome = async (
  paths: string[],
  dir: string,
  opts: { check: boolean },
): Promise<ToolResult> => {
  if (paths.length === 0) {
    return { tool: "biome", ok: true, diagnostics: [] }
  }
  return withBiome(dir, (biome, projectKey) =>
    applyFormat(
      "biome",
      paths,
      opts.check,
      (file, text) => biome.formatContent(projectKey, text, { filePath: file }).content,
    ),
  )
}
