import { defineCommand } from "citty"
import { parseFilter, printReport } from "../../lint/diagnostics"
import { lintAll } from "../../lint/orchestrate"

/** `aid lint`. It exits 1 when any tool fails, so CI can gate on it. */
export const command = defineCommand({
  meta: {
    name: "lint",
    description:
      "Run bundled linters across markdown, OpenAPI, protobuf, CSS, and JS, TS, and JSON files.",
  },
  args: {
    dir: {
      type: "positional",
      required: false,
      description: "Project directory (default: current directory).",
    },
    fix: {
      type: "boolean",
      description:
        "Apply autofixes where the underlying tool supports it (markdown, bun). css has none.",
    },
    filter: {
      type: "string",
      description: "Comma-separated list of tools to run: md, openapi, bun, css, proto.",
    },
    format: {
      type: "enum",
      options: ["pretty", "json"],
      default: "pretty",
      description: "Output format.",
    },
  },
  async run({ args }) {
    const report = await lintAll({
      dir: args.dir ?? ".",
      fix: Boolean(args.fix),
      filter: parseFilter(args.filter),
    })
    printReport(report, args.format)
  },
})
