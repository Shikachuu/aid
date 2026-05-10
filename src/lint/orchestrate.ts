import { lintWithBiome } from "./biome"
import type { Tool, ToolResult } from "./diagnostics"
import { BIOME_PATTERNS, discover, MD_PATTERNS, OAPI_PATTERNS, PROTO_PATTERNS } from "./discovery"
import { lintMarkdown } from "./markdown"
import { lintOpenApi } from "./openapi"
import { lintProto } from "./proto"

/** Options consumed by `lintAll`. */
export type LintOptions = {
  dir: string
  fix: boolean
  filter: Set<Tool> | null
  format: "pretty" | "json"
}

/** Aggregate result of running every enabled linter over the project. */
export type LintReport = { ok: boolean; results: ToolResult[] }

const want = (filter: Set<Tool> | null, t: Tool): boolean => filter === null || filter.has(t)

/**
 * Run every enabled linter (markdown / OpenAPI / Biome / proto) over the
 * project, doing one centralized file-discovery pass first and dispatching
 * to per-format implementations.
 */
export const lintAll = async (opts: LintOptions): Promise<LintReport> => {
  const dir = opts.dir
  const [md, oa, bi, pr] = await Promise.all([
    want(opts.filter, "md") ? discover(dir, MD_PATTERNS) : Promise.resolve([]),
    want(opts.filter, "openapi") ? discover(dir, OAPI_PATTERNS) : Promise.resolve([]),
    want(opts.filter, "biome") ? discover(dir, BIOME_PATTERNS) : Promise.resolve([]),
    want(opts.filter, "proto") ? discover(dir, PROTO_PATTERNS) : Promise.resolve([]),
  ])
  const tasks: Promise<ToolResult>[] = []
  if (want(opts.filter, "md")) tasks.push(lintMarkdown(md, dir, { fix: opts.fix }))
  if (want(opts.filter, "openapi")) tasks.push(lintOpenApi(oa, dir))
  if (want(opts.filter, "biome")) tasks.push(lintWithBiome(bi, dir, { fix: opts.fix }))
  if (want(opts.filter, "proto")) tasks.push(lintProto(pr, dir))
  const results = await Promise.all(tasks)
  return { ok: results.every((r) => r.ok), results }
}
