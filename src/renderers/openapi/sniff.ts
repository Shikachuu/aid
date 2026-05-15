const PREFIX_BYTES = 64 * 1024

const YAML_RE = /^(openapi|swagger)\s*:\s*['"]?\d/m
const JSON_RE = /"(openapi|swagger)"\s*:\s*"\d/

/**
 * Cheap content-sniff for OpenAPI / Swagger specs. Reads at most the first
 * 64 KiB and runs a regex prescreen — a top-level `openapi: "3.x"` or
 * `swagger: "2.0"` key (in YAML or JSON). Returns `false` for any other
 * `.yaml` / `.yml` / `.json` file so data files in the content tree are
 * silently skipped by the router. Never parses the full document.
 */
export async function sniffOpenApi(absPath: string): Promise<boolean> {
  const prefix = await Bun.file(absPath).slice(0, PREFIX_BYTES).text()
  const lower = absPath.toLowerCase()
  if (lower.endsWith(".json")) {
    return JSON_RE.test(prefix)
  }
  return YAML_RE.test(prefix)
}
