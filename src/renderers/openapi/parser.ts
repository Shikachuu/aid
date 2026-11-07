import { dereference, normalize, upgrade } from "@scalar/openapi-parser"

/** Result of {@link parseOpenApi}. */
export type ParsedOpenApi = {
  /** Normalized OpenAPI 3.1 document with `$ref`s resolved. */
  doc: Record<string, unknown>
  /** Non-fatal `$ref` resolution failures, one line each. */
  warnings: string[]
}

/**
 * Parse a YAML or JSON OpenAPI source into a normalized 3.1 document,
 * upgrading Swagger 2.0 and OpenAPI 3.0 and resolving `$ref`s. Throws when the
 * source is not a mapping. `$ref` failures become warnings, so a spec with one
 * broken `$ref` still renders.
 */
export async function parseOpenApi(source: string, sourcePath: string): Promise<ParsedOpenApi> {
  let normalized: unknown
  try {
    normalized = normalize(source)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`aid: failed to parse OpenAPI source at ${sourcePath}: ${message}`, {
      cause: err,
    })
  }
  if (!normalized || typeof normalized !== "object" || Array.isArray(normalized)) {
    throw new Error(
      `aid: failed to parse OpenAPI source at ${sourcePath}: not a YAML or JSON mapping`,
    )
  }
  const upgraded = upgrade(normalized as Record<string, unknown>)
  const dereferenced = dereference(upgraded.specification as Record<string, unknown>)
  const doc = (dereferenced.specification ?? upgraded.specification) as Record<string, unknown>
  const warnings = (dereferenced.errors ?? []).map((e) => {
    const where = [e.path ?? []].flat().join("/") || "<root>"
    return `${where}: ${e.message}`
  })
  return { doc, warnings }
}
