import { defineCommand } from "citty"
import { z } from "zod"
import { loadBuildContext, PortSchema } from "../../core/config"
import { startDevSession } from "../../dev/session"
import { projectArgs } from "./build"

/** Start the local dev server with hot reload. */
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
    const port = args.port
      ? z.coerce.number().pipe(PortSchema).parse(args.port)
      : ctx.config.dev.port
    const host = args.host || ctx.config.dev.host
    await startDevSession({ ctx, host, port })
  },
})
