import type { Report, Tool } from "../lint/diagnostics"
import { runTools } from "../lint/discovery"
import { formatWithBiome } from "./biome"
import { formatMarkdown } from "./markdown"
import { formatOpenApi } from "./openapi"
import { formatProto } from "./proto"

/** Options for `formatAll`. A `null` filter runs every tool. */
export type FormatOptions = {
  dir: string
  check: boolean
  filter: Set<Tool> | null
}

/**
 * Run every enabled formatter over the project. In `check` mode no file is
 * written; each result lists the files that would change in `wouldChange`.
 */
export const formatAll = (opts: FormatOptions): Promise<Report> =>
  runTools(opts.dir, opts.filter, {
    md: (paths) => formatMarkdown(paths, opts.dir, { check: opts.check }),
    openapi: (paths) => formatOpenApi(paths, opts.dir, { check: opts.check }),
    biome: (paths) => formatWithBiome(paths, opts.dir, { check: opts.check }),
    proto: (paths) => formatProto(paths, opts.dir, { check: opts.check }),
  })
