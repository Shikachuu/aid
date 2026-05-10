import type { BuildContext } from "../core/types"

/**
 * Bun.serve handler that never blocks on a rebuild. Serves from an in-memory
 * page cache; on file change, postMessages a rebuild-worker and broadcasts an
 * SSE reload event when fresh output is available.
 *
 * Stub.
 */
export async function startDevServer(_ctx: BuildContext): Promise<void> {
  throw new Error("startDevServer(): not implemented")
}
