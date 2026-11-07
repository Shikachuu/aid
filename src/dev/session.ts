import path from "node:path"
import type { BuildContext } from "../core/types"
import { rebuild, serializeRuns } from "./loop"
import { type DevServerHandle, startDevServer, withSlash } from "./server"
import { broadcast, closeClients, type DevState } from "./state"
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
 * listening. The watcher and server keep the process alive until SIGINT,
 * SIGTERM, or a change to the config file.
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

  const runRebuild = serializeRuns(async () => {
    const result = await rebuild(state, ctx)
    if (result.ok) {
      console.log(`[aid] rebuilt in ${result.durationMs}ms`)
    } else {
      console.error(`[aid] build failed (${result.durationMs}ms): ${result.error.message}`)
    }
    handle.watchFiles(result.stylesheetDependencies)
  })

  const endAndExit = async (message: string) => {
    await endSession(state, server, message)
    process.exit(0)
  }

  const handle = watchContent(
    ctx,
    configPath,
    [path.resolve(ctx.cwd, ctx.config.stylesheet)],
    (configChanged) => {
      if (!configChanged) {
        void runRebuild()
        return
      }
      const message = `${path.basename(configPath)} changed. Restart \`aid dev\` to pick up the new configuration.`
      console.log(`[aid] ${message}`)
      handle.close()
      void endAndExit(message)
    },
  )
  handle.watchFiles(initial.stylesheetDependencies)

  const shutdown = () => {
    handle.close()
    void server.stop()
    process.exit(0)
  }
  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)
}

const END_SESSION_TIMEOUT_MS = 1000

/**
 * Send `message` to every open tab's overlay, then stop the server once the
 * frame has gone out, or after a second when a client does not drain.
 */
export async function endSession(
  state: DevState,
  server: DevServerHandle,
  message: string,
): Promise<void> {
  broadcast(state, "error-detail", JSON.stringify({ message }))
  closeClients(state)
  await Promise.race([server.stop(false), Bun.sleep(END_SESSION_TIMEOUT_MS)])
}
