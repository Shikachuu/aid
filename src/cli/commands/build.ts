import { defineCommand } from "citty"
import { loadConfig } from "../../core/config"
import { build } from "../../core/pipeline"
import type { BuildContext } from "../../core/types"

/** Build the static documentation site to the configured output directory. */
export const command = defineCommand({
  meta: {
    name: "build",
    description: "Build the static documentation site.",
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
    clean: {
      type: "boolean",
      description: "Delete the output directory before building.",
    },
  },
  async run({ args }) {
    const dir = resolveProjectDir(args.dir)
    const configPath = resolveUnder(dir, args.file)
    const config = await loadConfig(configPath)
    const ctx: BuildContext = {
      config,
      cwd: dir,
      contentDir: `${dir}/${config.dir.content}`,
      outputDir: `${dir}/${config.dir.output}`,
      templatesDir: config.dir.templates === "" ? null : `${dir}/${config.dir.templates}`,
      staticDir: `${dir}/${config.dir.static}`,
    }
    if (args.clean) {
      await Bun.$`rm -rf ${ctx.outputDir}`.quiet()
    }
    await build(ctx)
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
