const PREFIX_BYTES = 64 * 1024

const YAML_RE = /^(openapi|swagger)\s*:\s*['"]?\d/m
const JSON_RE = /"(openapi|swagger)"\s*:\s*"\d/

/**
 * Tell OpenAPI and Swagger specs apart from other YAML and JSON files, so data
 * files in the content tree never become pages. A YAML file counts when a
 * line in its first 64 KiB starts with an `openapi:` or `swagger:` version
 * key. A JSON file whose prefix mentions one is parsed, and it counts only
 * when that key is top-level. A JSON file that fails to parse counts, so the
 * renderer reports the syntax error instead of the page vanishing.
 */
export async function sniffOpenApi(absPath: string): Promise<boolean> {
  const file = Bun.file(absPath)
  const prefix = await file.slice(0, PREFIX_BYTES).text()
  if (!absPath.toLowerCase().endsWith(".json")) {
    return YAML_RE.test(prefix)
  }
  if (!JSON_RE.test(prefix)) {
    return false
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(await file.text())
  } catch {
    return true
  }
  const top = (parsed ?? {}) as { openapi?: unknown; swagger?: unknown }
  return [top.openapi, top.swagger].some((v) => typeof v === "string" && /^\d/.test(v))
}
