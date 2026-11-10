import { dirname } from "node:path"
import { renderPretty } from "../../src/lint/diagnostics"
import { formatMarkdown } from "../../src/fmt/markdown"

const file = Bun.argv[2]
if (file === undefined) {
  console.error("usage: bun .claude/hooks/format-markdown.ts <file.md>")
  process.exit(1)
}
const result = await formatMarkdown([file], dirname(file), { check: false })
if (!result.ok || result.diagnostics.some((d) => d.severity === "error")) {
  console.error(renderPretty([result]))
  process.exit(1)
}
