import type { BuildContext } from "./types"

/**
 * Top-level build orchestrator. Walks routes, dispatches per-format renderers
 * across a worker pool, runs Tailwind on the merged candidate set, emits
 * search index + llms.txt + side-channel exports, and writes to outputDir.
 *
 * Stub — wired up once renderers and worker pool land.
 */
export async function build(_ctx: BuildContext): Promise<void> {
  throw new Error("build(): not implemented")
}
