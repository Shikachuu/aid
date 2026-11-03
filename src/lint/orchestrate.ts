import { lintWithBun } from "./bun"
import { lintCss } from "./css"
import type { Report, Tool } from "./diagnostics"
import { runTools } from "./discovery"
import { lintMarkdown } from "./markdown"
import { lintOpenApi } from "./openapi"
import { lintProto } from "./proto"

/** Options for `lintAll`. A `null` filter runs every tool. */
export type LintOptions = {
  dir: string
  fix: boolean
  filter: Set<Tool> | null
}

/** Run every enabled linter over the project; `fix` applies the markdown and `bun lint` autofixes. */
export const lintAll = (opts: LintOptions): Promise<Report> =>
  runTools(opts.dir, opts.filter, {
    md: (paths) => lintMarkdown(paths, opts.dir, { fix: opts.fix }),
    openapi: (paths) => lintOpenApi(paths, opts.dir),
    bun: (paths) =>
      lintWithBun(
        paths.filter((p) => !p.endsWith(".css")),
        opts.dir,
        { fix: opts.fix },
      ),
    css: (paths) => lintCss(paths),
    proto: (paths) => lintProto(paths, opts.dir),
  })
