import { parse, parseAllDocuments } from "yaml"
import type { Diagnostic, ToolResult } from "../lint/diagnostics"
import { applyFormat } from "./apply"

const YAML_OPTIONS = { intAsBigInt: true } as const
const STRAY_END_MARKER = /\n---\s*$/

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
    const all = parseAllDocuments(text, YAML_OPTIONS)
    const docs = STRAY_END_MARKER.test(text) ? all.slice(0, -1) : all
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
    let data: unknown
    try {
      data = doc.toJS()
    } catch (err) {
      report(file, "error", "openapi/parse", err instanceof Error ? err.message : String(err))
      return text
    }
    const formatted = doc.toString({ indent: 2, lineWidth: 0 })
    if (!sameData(data, formatted)) {
      report(file, "warn", "openapi/lossy", "reformatting would change the spec's data; left as is")
      return text
    }
    return formatted
  })
  const failed = diagnostics.some((d) => d.severity === "error")
  return {
    ...result,
    ok: result.ok && !failed,
    diagnostics: [...result.diagnostics, ...diagnostics],
  }
}

const sameData = (before: unknown, after: string): boolean => {
  try {
    return Bun.deepEquals(before, parse(after, YAML_OPTIONS), true)
  } catch {
    return false
  }
}
