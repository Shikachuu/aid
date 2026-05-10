import { defineCommand } from "citty"

export const command = defineCommand({
  meta: {
    name: "lint",
    description: "Run bundled linters across markdown, OpenAPI, CSS, HTML, and JSON files.",
  },
  args: {
    dir: {
      type: "positional",
      required: false,
      description: "Project directory (default: current directory).",
    },
  },
  async run() {
    console.error("aid lint: not implemented")
    process.exit(1)
  },
})
