import { parse, parseAllDocuments } from "yaml"
import type { Diagnostic, ToolResult } from "../lint/diagnostics"
import { applyFormat } from "./apply"

const YAML_OPTIONS = { intAsBigInt: true } as const

/**
 * Reformat YAML OpenAPI specs in place, keeping comments, anchors, block
 * scalars and number spellings. JSON specs are left to the `bun` tool. A file
 * that fails to parse fails the run with `openapi/parse`; a file whose data
 * would change, or that holds several documents, is skipped with a warning.
 */
export const formatOpenApi = async (
  paths: string[],
  _dir: string,
  opts: { check: boolean },
): Promise<ToolResult> => {
  const diagnostics: Diagnostic[] = []
  const report = (file: string, severity: Diagnostic["severity"], code: string, message: string) =>
    diagnostics.push({ file, severity, code, message })
  const yamlPaths = paths.filter((file) => !file.endsWith(".json"))
  const result = await applyFormat("openapi", yamlPaths, opts.check, (file, text) => {
    const docs = parseAllDocuments(text, YAML_OPTIONS)
    const [doc] = docs
    if (doc === undefined) {
      return text
    }
    if (docs.length > 1) {
      report(
        file,
        "warn",
        "openapi/multi-document",
        "file holds several YAML documents; left as is",
      )
      return text
    }
    const [error] = doc.errors
    if (error !== undefined) {
      report(file, "error", "openapi/parse", error.message)
      return text
    }
    const formatted = doc.toString({ indent: 2 })
    if (!Bun.deepEquals(parse(text, YAML_OPTIONS), parse(formatted, YAML_OPTIONS), true)) {
      report(file, "warn", "openapi/lossy", "reformatting would change the spec's data; left as is")
      return text
    }
    return formatted
  })
  const failed = diagnostics.some((d) => d.severity === "error")
  return { ...result, ok: result.ok && !failed, diagnostics }
}
