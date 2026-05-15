import { defineCommand } from "citty"
import { loadConfig } from "../../core/config"
import type { BuildContext } from "../../core/types"
import { startDevSession } from "../../dev/session"

/** Start the local dev server with hot reload. */
export const command = defineCommand({
  meta: {
    name: "dev",
    description: "Start the local dev server with hot reload.",
  },
  args: {
    dir: {
      type: "positional",
      required: false,
      description: "Project directory (default: current directory).",
    },
    file: {
      type: "string",
      alias: "f",
      default: "aid.yaml",
      description: "Config file relative to the project directory (e.g. aid.yml).",
    },
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
    const dir = resolveProjectDir(args.dir)
    const configPath = resolveUnder(dir, args.file)
    const config = await loadConfig(configPath)

    const port = resolvePort(args.port, config.dev.port)
    const host = args.host !== undefined && args.host !== "" ? args.host : config.dev.host

    const ctx: BuildContext = {
      config,
      cwd: dir,
      contentDir: `${dir}/${config.dir.content}`,
      outputDir: `${dir}/${config.dir.output}`,
      templatesDir: config.dir.templates === "" ? null : `${dir}/${config.dir.templates}`,
      staticDir: `${dir}/${config.dir.static}`,
    }

    await startDevSession({ ctx, host, port })
  },
})

function resolveProjectDir(input: string | undefined): string {
  if (input === undefined || input === ".") {
    return process.cwd()
  }
  return input.startsWith("/") ? input : `${process.cwd()}/${input}`
}

function resolveUnder(dir: string, p: string): string {
  return p.startsWith("/") ? p : `${dir}/${p}`
}

function resolvePort(flag: string | undefined, fallback: number): number {
  if (flag === undefined || flag === "") {
    return fallback
  }
  const n = Number.parseInt(flag, 10)
  if (!Number.isFinite(n) || n < 0 || n > 65535) {
    throw new Error(`aid dev: --port must be an integer between 0 and 65535, got "${flag}"`)
  }
  return n
}
