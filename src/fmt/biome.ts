import { Biome } from "@biomejs/js-api/nodejs"
import { resolveBiomeConfig } from "../lint/biome"
import type { ToolResult } from "../lint/diagnostics"

/**
 * Format files via Biome's WASM JS API (CSS / JSON / JS / TS).
 * `--check` mode reports `wouldChange` instead of writing.
 */
export const formatWithBiome = async (
  paths: string[],
  dir: string,
  opts: { check: boolean },
): Promise<ToolResult> => {
  if (paths.length === 0) {
    return { tool: "biome", ok: true, diagnostics: [] }
  }
  const config = await resolveBiomeConfig(dir)
  const biome = new Biome()
  try {
    const { projectKey } = biome.openProject(dir)
    biome.applyConfiguration(projectKey, config)
    const wouldChange: string[] = []
    let ok = true
    for (const file of paths) {
      const original = await Bun.file(file).text()
      const res = biome.formatContent(projectKey, original, { filePath: file })
      if (res.content === original) {
        continue
      }
      if (opts.check) {
        wouldChange.push(file)
        ok = false
      } else {
        await Bun.write(file, res.content)
      }
    }
    return { tool: "biome", ok, diagnostics: [], wouldChange: opts.check ? wouldChange : undefined }
  } finally {
    biome.shutdown()
  }
}
