import path from "node:path"
import type { BuildContext } from "../core/types"
import { rebuild, serializeRuns } from "./loop"
import { type DevServerHandle, startDevServer, withSlash } from "./server"
import { broadcast, closeClients, type DevState } from "./state"
import { watchContent } from "./watcher"

/** Inputs for `startDevSession`. */
type StartDevSessionArgs = {
  ctx: BuildContext
  host: string
  port: number
  /** Config file the session watches; a change to it ends the session. */
  configPath: string
}

/**
 * Run `aid dev`. The server and the watcher start before the initial build,
 * so a tab opened early gets the waiting page and a save during the build
 * queues one more build. Returns after the initial build. The watcher and
 * server keep the process alive until SIGINT, SIGTERM, or a change to the
 * config file.
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

  const server = startDevServer({ state, config: ctx.config, host, port })
  console.log(
    `[aid] dev server listening at http://${urlHost(host)}:${server.port}${withSlash(ctx.config.base_path)}`,
  )

  let initial = true
  const runRebuild = serializeRuns(async () => {
    const result = await rebuild(state, ctx)
    const ms = result.durationMs
    if (result.ok) {
      console.log(initial ? `[aid] initial build: ${ms}ms` : `[aid] rebuilt in ${ms}ms`)
    } else {
      const what = initial ? "initial build" : "build"
      console.error(`[aid] ${what} failed (${ms}ms): ${result.error.message}`)
    }
    initial = false
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

  const shutdown = () => {
    handle.close()
    void server.stop()
    process.exit(0)
  }
  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)

  await runRebuild()
}

/** Wrap an IPv6 literal in brackets so the printed URL opens in a browser. */
export const urlHost = (host: string): string => (host.includes(":") ? `[${host}]` : host)

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
