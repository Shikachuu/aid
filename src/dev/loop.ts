import { rm } from "node:fs/promises"
import path from "node:path"
import { build } from "../core/pipeline"
import type { BuildContext } from "../core/types"
import { broadcast, type DevErrorPayload, type DevState, toErrorPayload } from "./state"

/**
 * Outcome of one `rebuild`. Both outcomes list the stylesheet partials, so a
 * partial whose error failed the build still gets watched. A failure also lists
 * the relative `@import` targets, including one that does not exist yet.
 */
export type RebuildResult = { durationMs: number; stylesheetDependencies: string[] } & (
  { ok: true } | { ok: false; error: DevErrorPayload }
)

/**
 * Run a full build into the inactive buffer. On success, flip `state.currentDir`
 * to point at the freshly-built directory and broadcast a `reload` SSE event.
 * On failure, leave `currentDir` untouched, store the error in `state.errorState`,
 * and broadcast an `error-detail` SSE event so connected browsers can render the
 * overlay without a page reload.
 */
export async function rebuild(state: DevState, ctx: BuildContext): Promise<RebuildResult> {
  const target = state.currentDir === state.buffers.a ? state.buffers.b : state.buffers.a
  const start = performance.now()
  const elapsed = () => Math.round(performance.now() - start)
  const stylesheetDependencies: string[] = []
  try {
    await rm(target, { recursive: true, force: true })
    await build(
      { ...ctx, outputDir: target },
      { onStylesheetDependency: (dep) => stylesheetDependencies.push(dep) },
    )
    state.currentDir = target
    state.errorState = null
    broadcast(state, "clear-error", "")
    broadcast(state, "reload", "")
    return { ok: true, durationMs: elapsed(), stylesheetDependencies }
  } catch (err) {
    stylesheetDependencies.push(
      ...(await relativeImports([
        path.resolve(ctx.cwd, ctx.config.stylesheet),
        ...stylesheetDependencies,
      ])),
    )
    const error = toErrorPayload(err)
    state.errorState = error
    broadcast(state, "error-detail", JSON.stringify(error))
    return { ok: false, durationMs: elapsed(), stylesheetDependencies, error }
  }
}

const RELATIVE_IMPORT_RE = /@(?:import|reference)\s+(?:url\(\s*)?["'](\.{1,2}\/[^"']+)["']/g

async function relativeImports(files: readonly string[]): Promise<string[]> {
  const found: string[] = []
  for (const file of files) {
    const css = await Bun.file(file)
      .text()
      .catch(() => "")
    for (const [, specifier = ""] of css.matchAll(RELATIVE_IMPORT_RE)) {
      const target = path.resolve(path.dirname(file), specifier)
      found.push(target, `${target}.css`, path.join(target, "index.css"))
    }
  }
  return found
}

/**
 * Wrap `run` so that only one call is in flight. Calls that arrive meanwhile
 * collapse into one more run after the current one, so a burst of saves costs
 * at most two builds.
 */
export function serializeRuns(run: () => Promise<void>): () => Promise<void> {
  let running = false
  let queued = false
  return async () => {
    if (running) {
      queued = true
      return
    }
    running = true
    try {
      do {
        queued = false
        await run()
      } while (queued)
    } finally {
      running = false
    }
  }
}
