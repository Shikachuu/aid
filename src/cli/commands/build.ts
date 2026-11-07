import { rm } from "node:fs/promises"
import { defineCommand } from "citty"
import { assertSafeToClean, loadBuildContext } from "../../core/config"
import { build } from "../../core/pipeline"

/** Positional project directory and `--file` config path, shared by `build` and `dev`. */
export const projectArgs = {
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
} as const

/** `aid build`. Pass `--clean` to drop outputs left behind by deleted pages. */
export const command = defineCommand({
  meta: {
    name: "build",
    description: "Build the static documentation site.",
  },
  args: {
    ...projectArgs,
    clean: {
      type: "boolean",
      description: "Delete the output directory before building.",
    },
  },
  async run({ args }) {
    const ctx = await loadBuildContext(args.dir, args.file)
    if (args.clean) {
      assertSafeToClean(ctx)
      await rm(ctx.outputDir, { recursive: true, force: true })
    }
    await build(ctx)
  },
})
