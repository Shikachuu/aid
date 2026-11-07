const PREFIX_BYTES = 64 * 1024

const DIALECT_RE = /^https?:\/\/json-schema\.org\//
const PREFILTER_RE = /\$schema['"]?\s*:\s*['"]?https?:\\?\/\\?\/json-schema\.org\\?\//

/**
 * Tell JSON Schema documents apart from other YAML and JSON files. A file
 * whose first 64 KiB mention a `json-schema.org` `$schema` is parsed, and it
 * counts only when that `$schema` is a top-level key, so data files that embed
 * a schema fragment stay skipped. A file that fails to parse counts, so the
 * renderer reports the syntax error instead of the page vanishing.
 */
export async function sniffJsonSchema(absPath: string): Promise<boolean> {
  const file = Bun.file(absPath)
  const isJson = absPath.toLowerCase().endsWith(".json")
  const prefix = await file.slice(0, PREFIX_BYTES).text()
  if (!PREFILTER_RE.test(prefix)) {
    return false
  }
  let parsed: unknown
  try {
    const text = await file.text()
    parsed = isJson ? JSON.parse(text) : Bun.YAML.parse(text)
  } catch {
    return true
  }
  const dialect = (parsed as { $schema?: unknown } | null)?.$schema
  return typeof dialect === "string" && DIALECT_RE.test(dialect)
}
