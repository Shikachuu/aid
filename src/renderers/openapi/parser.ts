import { dereference, normalize, upgrade } from "@scalar/openapi-parser"

/** Result of {@link parseOpenApi}. */
export type ParsedOpenApi = {
  /** Normalized OpenAPI 3.1 document with `$ref`s resolved. */
  doc: Record<string, unknown>
  /** Non-fatal messages — Swagger 2.0 upgrades and partial deref failures end up here. */
  warnings: string[]
}

/**
 * Parse an OpenAPI spec source (YAML or JSON) into a normalized 3.1 document.
 * Runs the parser pipeline: normalize → upgrade (Swagger 2.0 / 3.0 → 3.1) →
 * dereference (`$ref` resolution). A failure to parse or upgrade is a hard
 * build error; deref errors surface as warnings so a spec with a single
 * broken `$ref` still renders.
 */
export async function parseOpenApi(source: string, sourcePath: string): Promise<ParsedOpenApi> {
  const normalized = normalize(source)
  if (!normalized || typeof normalized !== "object" || Array.isArray(normalized)) {
    throw new Error(
      `aid: failed to parse OpenAPI source at ${sourcePath} — not a YAML/JSON mapping`,
    )
  }
  const upgraded = upgrade(normalized as Record<string, unknown>)
  const dereferenced = dereference(upgraded.specification as Record<string, unknown>)
  const doc = (dereferenced.specification ?? upgraded.specification) as Record<string, unknown>
  const warnings = (dereferenced.errors ?? []).map(
    (e) => `${sourcePath}: ${e.path?.join("/") ?? "<root>"} — ${e.message}`,
  )
  return { doc, warnings }
}
