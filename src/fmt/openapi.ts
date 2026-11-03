import type { Diagnostic, ToolResult } from "../lint/diagnostics"
import { applyFormat } from "./apply"

/**
 * Canonicalize OpenAPI files: round-trip `.yaml`/`.yml` through `Bun.YAML` and
 * `.json` through `JSON.parse`/`JSON.stringify`. Spectral has no formatter, so
 * this is a structural reformat only. A file that fails to parse stays
 * untouched and fails the run with an `openapi/parse` error.
 *
 * `Bun.YAML` does not keep comments, so formatting a YAML spec drops them.
 */
export const formatOpenApi = async (
  paths: string[],
  _dir: string,
  opts: { check: boolean },
): Promise<ToolResult> => {
  const diagnostics: Diagnostic[] = []
  const result = await applyFormat("openapi", paths, opts.check, (file, text) => {
    try {
      return file.endsWith(".json")
        ? `${JSON.stringify(JSON.parse(text), null, 2)}\n`
        : `${Bun.YAML.stringify(Bun.YAML.parse(text), null, 2)
            .replace(/[ \t]+$/gm, "")
            .trimEnd()}\n`
    } catch (err) {
      diagnostics.push({
        file,
        severity: "error",
        code: "openapi/parse",
        message: err instanceof Error ? err.message : String(err),
      })
      return text
    }
  })
  return { ...result, ok: result.ok && diagnostics.length === 0, diagnostics }
}
