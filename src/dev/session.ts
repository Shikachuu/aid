import path from "node:path"
import type { BuildContext } from "../core/types"
import { rebuild } from "./loop"
import { startDevServer } from "./server"
import { broadcast, createDevState, serializeError } from "./state"
import { type ChangeBatch, watchContent } from "./watcher"

export type StartDevSessionArgs = {
  ctx: BuildContext
  host: string
  port: number
}

/**
 * Run the dev server end-to-end: prepare the double-buffered output dirs under
 * `.aid/dev/`, write `.aid/.gitignore`, kick off the initial build, start
 * Bun.serve, and begin watching the filesystem. Returns once the server is
 * listening; the watcher and server keep the process alive until the user
 * sends SIGINT.
 */
export async function startDevSession(args: StartDevSessionArgs): Promise<void> {
  const { ctx, host, port } = args

  const aidDir = path.join(ctx.cwd, ".aid")
  const devDir = path.join(aidDir, "dev")
  const buffers = { a: path.join(devDir, "build-a"), b: path.join(devDir, "build-b") }

  await Bun.write(path.join(aidDir, ".gitignore"), "*\n")

  const state = createDevState(buffers)

  const stylesheetPath = path.join(ctx.cwd, ctx.config.stylesheet)

  const initial = await rebuild(state, ctx)
  if (initial.ok) {
    console.log(`[aid] initial build: ${initial.durationMs}ms`)
  } else {
    console.error(`[aid] initial build failed (${initial.durationMs}ms): ${initial.error.message}`)
  }

  const server = startDevServer({ state, config: ctx.config, host, port })

  const url = buildUrl(host, server.port, ctx.config.base_path)
  console.log(`[aid] dev server listening at ${url}`)

  let inFlight: Promise<unknown> | null = null
  let queued = false

  const runRebuild = async () => {
    if (inFlight !== null) {
      queued = true
      return
    }
    do {
      queued = false
      inFlight = rebuild(state, ctx)
      const result = (await inFlight) as Awaited<ReturnType<typeof rebuild>>
      inFlight = null
      if (result.ok) {
        console.log(`[aid] rebuilt in ${result.durationMs}ms`)
      } else {
        console.error(`[aid] build failed (${result.durationMs}ms): ${result.error.message}`)
      }
    } while (queued)
  }

  const onChange = (batch: ChangeBatch) => {
    if (batch.configChanged) {
      const message = "aid.yaml changed. Restart `aid dev` to pick up the new configuration."
      console.log(`[aid] ${message}`)
      broadcast(state, "error-detail", serializeError({ message }))
      handle.close()
      server.stop()
      process.exit(0)
    }
    void runRebuild()
  }

  const handle = watchContent(ctx, [stylesheetPath], onChange)

  const shutdown = () => {
    handle.close()
    server.stop()
    process.exit(0)
  }
  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)
}

function buildUrl(host: string, port: number, basePath: string): string {
  const norm = basePath.endsWith("/") ? basePath : `${basePath}/`
  return `http://${host}:${port}${norm}`
}
