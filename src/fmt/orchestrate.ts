import { formatWithBiome } from "./biome"
import { formatMarkdown } from "./markdown"
import { formatOpenApi } from "./openapi"

export async function formatAll(_dir: string): Promise<{ ok: boolean }> {
  const md = await formatMarkdown([])
  const oa = await formatOpenApi([])
  const biome = await formatWithBiome([])
  return { ok: md.ok && oa.ok && biome.ok }
}
