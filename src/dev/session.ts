import path from "node:path"
import type { BuildContext } from "../core/types"
import { rebuild } from "./loop"
import { startDevServer, withSlash } from "./server"
import { broadcast, type DevState } from "./state"
import { watchContent } from "./watcher"

/** Inputs for `startDevSession`. */
export type StartDevSessionArgs = {
  ctx: BuildContext
  host: string
  port: number
  /** Config file the session watches; a change to it ends the session. */
  configPath: string
}

/**
 * Run the dev server end-to-end: prepare the double-buffered output dirs under
 * `.aid/dev/`, write `.aid/.gitignore`, kick off the initial build, start
 * Bun.serve, and begin watching the filesystem. Returns once the server is
 * listening; the watcher and server keep the process alive until the user
 * sends SIGINT.
 */
export async function startDevSession(args: StartDevSessionArgs): Promise<void> {
  const { ctx, host, port, configPath } = args

  const aidDir = path.join(ctx.cwd, ".aid")
  const devDir = path.join(aidDir, "dev")

  await Bun.write(path.join(aidDir, ".gitignore"), "*\n")

  const state: DevState = {
    currentDir: null,
    buffers: { a: path.join(devDir, "build-a"), b: path.join(devDir, "build-b") },
    errorState: null,
    sseClients: new Set(),
  }

  const initial = await rebuild(state, ctx)
  if (initial.ok) {
    console.log(`[aid] initial build: ${initial.durationMs}ms`)
  } else {
    console.error(`[aid] initial build failed (${initial.durationMs}ms): ${initial.error.message}`)
  }

  const server = startDevServer({ state, config: ctx.config, host, port })
  console.log(
    `[aid] dev server listening at http://${host}:${server.port}${withSlash(ctx.config.base_path)}`,
  )

  let running = false
  let queued = false

  const runRebuild = async () => {
    if (running) {
      queued = true
      return
    }
    running = true
    do {
      queued = false
      const result = await rebuild(state, ctx)
      if (result.ok) {
        console.log(`[aid] rebuilt in ${result.durationMs}ms`)
      } else {
        console.error(`[aid] build failed (${result.durationMs}ms): ${result.error.message}`)
      }
    } while (queued)
    running = false
  }

  const handle = watchContent(
    ctx,
    configPath,
    [path.join(ctx.cwd, ctx.config.stylesheet)],
    (configChanged) => {
      if (configChanged) {
        const message = `${path.basename(configPath)} changed. Restart \`aid dev\` to pick up the new configuration.`
        console.log(`[aid] ${message}`)
        broadcast(state, "error-detail", JSON.stringify({ message }))
        shutdown()
      }
      void runRebuild()
    },
  )

  const shutdown = () => {
    handle.close()
    server.stop()
    process.exit(0)
  }
  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)
}
