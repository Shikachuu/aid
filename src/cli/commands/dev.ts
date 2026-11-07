import path from "node:path"
import { defineCommand } from "citty"
import { loadBuildContext, PortSchema } from "../../core/config"
import { startDevSession } from "../../dev/session"
import { projectArgs } from "./build"

const parsePortFlag = (value: string): number => {
  const port = PortSchema.safeParse(/^\d+$/.test(value) ? Number(value) : Number.NaN)
  if (!port.success) {
    throw new Error(`aid: --port must be an integer from 0 to 65535, got "${value}".`)
  }
  return port.data
}

/** `aid dev`. `--port` and `--host` override `dev.port` and `dev.host` from the config. */
export const command = defineCommand({
  meta: {
    name: "dev",
    description: "Start the local dev server with hot reload.",
  },
  args: {
    ...projectArgs,
    port: {
      type: "string",
      description: "Override dev server port.",
    },
    host: {
      type: "string",
      description: "Override dev server host.",
    },
  },
  async run({ args }) {
    const ctx = await loadBuildContext(args.dir, args.file)
    const port = args.port === undefined ? ctx.config.dev.port : parsePortFlag(args.port)
    const host = args.host || ctx.config.dev.host
    await startDevSession({ ctx, host, port, configPath: path.resolve(ctx.cwd, args.file) })
  },
})
