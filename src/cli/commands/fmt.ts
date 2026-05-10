import { defineCommand } from "citty"
import { formatAll } from "../../fmt/orchestrate"
import { renderJson, renderPretty, type Tool } from "../../lint/diagnostics"

const KNOWN_TOOLS: ReadonlySet<Tool> = new Set(["md", "openapi", "biome", "proto"])

const parseFilter = (raw: string | undefined): Set<Tool> | null => {
  if (raw === undefined || raw.length === 0) return null
  const out = new Set<Tool>()
  for (const part of raw.split(",")) {
    const trimmed = part.trim() as Tool
    if (KNOWN_TOOLS.has(trimmed)) out.add(trimmed)
  }
  return out.size === 0 ? null : out
}

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
      type: "string",
      description: "Output format: 'pretty' (default) or 'json'.",
    },
  },
  async run({ args }) {
    const dir = args.dir ?? "."
    const format = args.format === "json" ? "json" : "pretty"
    const report = await formatAll({
      dir,
      check: Boolean(args.check),
      filter: parseFilter(args.filter),
      format,
    })
    const out = format === "json" ? renderJson(report.results) : renderPretty(report.results)
    process.stdout.write(`${out}\n`)
    process.exit(report.ok ? 0 : 1)
  },
})
