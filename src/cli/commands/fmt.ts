import { defineCommand } from "citty"
import { formatAll } from "../../fmt/orchestrate"
import { parseFilter, printReport } from "../../lint/diagnostics"

export const command = defineCommand({
  meta: {
    name: "fmt",
    description:
      "Run bundled formatters across markdown, OpenAPI, CSS, HTML, JSON, and protobuf files.",
  },
  args: {
    dir: {
      type: "positional",
      required: false,
      description: "Project directory (default: current directory).",
    },
    check: {
      type: "boolean",
      description: "Don't write changes; exit non-zero if any file would be reformatted.",
    },
    filter: {
      type: "string",
      description: "Comma-separated list of tools to run: md, openapi, biome, proto.",
    },
    format: {
      type: "enum",
      options: ["pretty", "json"],
      default: "pretty",
      description: "Output format.",
    },
  },
  async run({ args }) {
    const report = await formatAll({
      dir: args.dir ?? ".",
      check: Boolean(args.check),
      filter: parseFilter(args.filter),
    })
    printReport(report, args.format)
  },
})
