import { build } from "../core/pipeline"
import type { BuildContext } from "../core/types"
import { broadcast, type DevErrorPayload, type DevState, toErrorPayload } from "./state"

/** Outcome of one `rebuild`, with its wall-clock duration for the console log. */
export type RebuildResult =
  { ok: true; durationMs: number } | { ok: false; durationMs: number; error: DevErrorPayload }

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
  try {
    await Bun.$`rm -rf ${target}`.quiet()
    await build({ ...ctx, outputDir: target })
    state.currentDir = target
    state.errorState = null
    broadcast(state, "clear-error", "")
    broadcast(state, "reload", "")
    return { ok: true, durationMs: elapsed() }
  } catch (err) {
    const error = toErrorPayload(err)
    state.errorState = error
    broadcast(state, "error-detail", JSON.stringify(error))
    return { ok: false, durationMs: elapsed(), error }
  }
}
