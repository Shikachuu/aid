import type { ToolResult } from "../lint/diagnostics"

/**
 * Canonicalize OpenAPI files: round-trip `.yaml`/`.yml` through `Bun.YAML` and
 * `.json` through `JSON.parse`/`JSON.stringify`. Spectral has no formatter, so
 * this is a structural reformat only.
 *
 * **Caveat:** YAML comments are not preserved by `Bun.YAML`.
 */
export const formatOpenApi = async (
  paths: string[],
  _dir: string,
  opts: { check: boolean },
): Promise<ToolResult> => {
  if (paths.length === 0) return { tool: "openapi", ok: true, diagnostics: [] }
  const wouldChange: string[] = []
  let ok = true
  for (const file of paths) {
    const original = await Bun.file(file).text()
    let formatted: string
    try {
      if (file.endsWith(".json")) {
        formatted = `${JSON.stringify(JSON.parse(original), null, 2)}\n`
      } else {
        formatted = Bun.YAML.stringify(Bun.YAML.parse(original))
      }
    } catch {
      // skip files we can't parse
      continue
    }
    if (formatted === original) continue
    if (opts.check) {
      wouldChange.push(file)
      ok = false
    } else {
      await Bun.write(file, formatted)
    }
  }
  return { tool: "openapi", ok, diagnostics: [], wouldChange: opts.check ? wouldChange : undefined }
}
