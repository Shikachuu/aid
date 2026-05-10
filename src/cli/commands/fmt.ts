import { defineCommand } from "citty"

export const command = defineCommand({
  meta: {
    name: "fmt",
    description: "Run bundled formatters across markdown, OpenAPI, CSS, HTML, and JSON files.",
  },
  args: {
    dir: {
      type: "positional",
      required: false,
      description: "Project directory (default: current directory).",
    },
  },
  async run() {
    console.error("aid fmt: not implemented")
    process.exit(1)
  },
})
