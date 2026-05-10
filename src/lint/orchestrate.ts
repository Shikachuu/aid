import { lintWithBiome } from "./biome"
import { lintMarkdown } from "./markdown"
import { lintOpenApi } from "./openapi"

/**
 * Run all bundled linters across the project. Stub.
 */
export async function lintAll(_dir: string): Promise<{ ok: boolean }> {
  const md = await lintMarkdown([])
  const oa = await lintOpenApi([])
  const biome = await lintWithBiome([])
  return { ok: md.ok && oa.ok && biome.ok }
}
