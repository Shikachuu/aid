import { build } from "../core/pipeline"
import type { BuildContext } from "../core/types"
import { broadcast, type DevState, serializeError, toErrorPayload } from "./state"

export type RebuildResult =
  | { ok: true; durationMs: number; outputDir: string }
  | { ok: false; durationMs: number; error: ReturnType<typeof toErrorPayload> }

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
  try {
    await Bun.$`rm -rf ${target}`.quiet()
    const rebuildCtx: BuildContext = { ...ctx, outputDir: target }
    await build(rebuildCtx)
    state.currentDir = target
    state.errorState = null
    broadcast(state, "clear-error", "")
    broadcast(state, "reload", "")
    const durationMs = Math.round(performance.now() - start)
    return { ok: true, durationMs, outputDir: target }
  } catch (err) {
    const error = toErrorPayload(err)
    state.errorState = error
    broadcast(state, "error-detail", serializeError(error))
    const durationMs = Math.round(performance.now() - start)
    return { ok: false, durationMs, error }
  }
}
