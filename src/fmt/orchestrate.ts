import type { Tool, ToolResult } from "../lint/diagnostics"
import {
  BIOME_PATTERNS,
  discover,
  MD_PATTERNS,
  OAPI_PATTERNS,
  PROTO_PATTERNS,
} from "../lint/discovery"
import { formatWithBiome } from "./biome"
import { formatMarkdown } from "./markdown"
import { formatOpenApi } from "./openapi"
import { formatProto } from "./proto"

/** Options consumed by `formatAll`. */
export type FormatOptions = {
  dir: string
  check: boolean
  filter: Set<Tool> | null
  format: "pretty" | "json"
}

/** Aggregate result of running every enabled formatter over the project. */
export type FormatReport = { ok: boolean; results: ToolResult[] }

const want = (filter: Set<Tool> | null, t: Tool): boolean => filter === null || filter.has(t)

/**
 * Run every enabled formatter over the project. In `--check` mode, no files
 * are written; instead `wouldChange` lists files that would be reformatted.
 */
export const formatAll = async (opts: FormatOptions): Promise<FormatReport> => {
  const dir = opts.dir
  const [md, oa, bi, pr] = await Promise.all([
    want(opts.filter, "md") ? discover(dir, MD_PATTERNS) : Promise.resolve([]),
    want(opts.filter, "openapi") ? discover(dir, OAPI_PATTERNS) : Promise.resolve([]),
    want(opts.filter, "biome") ? discover(dir, BIOME_PATTERNS) : Promise.resolve([]),
    want(opts.filter, "proto") ? discover(dir, PROTO_PATTERNS) : Promise.resolve([]),
  ])
  const tasks: Promise<ToolResult>[] = []
  if (want(opts.filter, "md")) {
    tasks.push(formatMarkdown(md, dir, { check: opts.check }))
  }
  if (want(opts.filter, "openapi")) {
    tasks.push(formatOpenApi(oa, dir, { check: opts.check }))
  }
  if (want(opts.filter, "biome")) {
    tasks.push(formatWithBiome(bi, dir, { check: opts.check }))
  }
  if (want(opts.filter, "proto")) {
    tasks.push(formatProto(pr, dir, { check: opts.check }))
  }
  const results = await Promise.all(tasks)
  return { ok: results.every((r) => r.ok), results }
}
