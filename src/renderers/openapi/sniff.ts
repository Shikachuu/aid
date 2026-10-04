const PREFIX_BYTES = 64 * 1024

const YAML_RE = /^(openapi|swagger)\s*:\s*['"]?\d/m
const JSON_RE = /"(openapi|swagger)"\s*:\s*"\d/

/**
 * Tell OpenAPI and Swagger specs apart from other YAML and JSON files without
 * parsing them. Matches an `openapi:` or `swagger:` version key in the first
 * 64 KiB. The router skips files that return `false`, so data files in the
 * content tree never become pages.
 */
export async function sniffOpenApi(absPath: string): Promise<boolean> {
  const prefix = await Bun.file(absPath).slice(0, PREFIX_BYTES).text()
  const lower = absPath.toLowerCase()
  if (lower.endsWith(".json")) {
    return JSON_RE.test(prefix)
  }
  return YAML_RE.test(prefix)
}
