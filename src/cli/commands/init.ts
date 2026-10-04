import { defineCommand } from "citty"

/** `aid init`. Not implemented yet, so it exits 1. */
export const command = defineCommand({
  meta: {
    name: "init",
    description: "Scaffold a new aid project in the current directory.",
  },
  args: {
    dir: {
      type: "positional",
      required: false,
      description: "Target directory (default: current directory).",
    },
  },
  async run({ args }) {
    const target = args.dir ?? "."
    console.error(`aid init ${target}: not implemented`)
    process.exit(1)
  },
})
