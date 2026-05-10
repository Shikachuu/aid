import { defineCommand } from "citty"

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
  },
  async run() {
    console.error("aid build: not implemented")
    process.exit(1)
  },
})
