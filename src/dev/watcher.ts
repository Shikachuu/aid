import type { BuildContext } from "../core/types"

/**
 * fs.watch wrapper with debounce. Emits `{ changedPaths }` events to the
 * rebuild worker via the provided callback.
 *
 * Stub.
 */
export function watchContent(_ctx: BuildContext, _onChange: (paths: string[]) => void): () => void {
  return () => {}
}
