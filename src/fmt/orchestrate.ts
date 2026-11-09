import { KNOWN_TOOLS, type Report, type Tool } from "../lint/diagnostics"
import { runTools } from "../lint/discovery"
import { formatWithBun } from "./bun"
import { formatMarkdown } from "./markdown"
import { formatOpenApi } from "./openapi"
import { formatProto } from "./proto"

/** Tools `aid fmt` runs. The `css` tool only lints. */
export const FORMAT_TOOLS: readonly Tool[] = KNOWN_TOOLS.filter((tool) => tool !== "css")

/** Options for `formatAll`. A `null` filter runs every tool. */
type FormatOptions = {
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
    bun: (paths) => formatWithBun(paths, opts.dir, { check: opts.check }),
    proto: (paths) => formatProto(paths, opts.dir, { check: opts.check }),
  })
