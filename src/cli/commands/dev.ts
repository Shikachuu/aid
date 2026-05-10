import { defineCommand } from "citty"

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
    port: {
      type: "string",
      description: "Override dev server port.",
    },
    host: {
      type: "string",
      description: "Override dev server host.",
    },
  },
  async run() {
    console.error("aid dev: not implemented")
    process.exit(1)
  },
})
