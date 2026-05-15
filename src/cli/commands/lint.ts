import { defineCommand } from "citty"
import { renderJson, renderPretty, type Tool } from "../../lint/diagnostics"
import { lintAll } from "../../lint/orchestrate"

const KNOWN_TOOLS: ReadonlySet<Tool> = new Set(["md", "openapi", "biome", "proto"])

const parseFilter = (raw: string | undefined): Set<Tool> | null => {
  if (raw === undefined || raw.length === 0) {
    return null
  }
  const out = new Set<Tool>()
  for (const part of raw.split(",")) {
    const trimmed = part.trim() as Tool
    if (KNOWN_TOOLS.has(trimmed)) {
      out.add(trimmed)
    }
  }
  return out.size === 0 ? null : out
}

export const command = defineCommand({
  meta: {
    name: "lint",
    description:
      "Run bundled linters across markdown, OpenAPI, CSS, HTML, JSON, and protobuf files.",
  },
  args: {
    dir: {
      type: "positional",
      required: false,
      description: "Project directory (default: current directory).",
    },
    fix: {
      type: "boolean",
      description: "Apply autofixes where the underlying tool supports it (markdown, biome).",
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
    const report = await lintAll({
      dir,
      fix: Boolean(args.fix),
      filter: parseFilter(args.filter),
      format,
    })
    const out = format === "json" ? renderJson(report.results) : renderPretty(report.results)
    process.stdout.write(`${out}\n`)
    process.exit(report.ok ? 0 : 1)
  },
})
