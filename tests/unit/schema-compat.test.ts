import { expect, test } from "bun:test"
import path from "node:path"

const PUBLISHED_KEYS = [
  "ai_targets",
  "ai_targets[]=chatgpt",
  "ai_targets[]=claude",
  "ai_targets[]=gemini",
  "base_path",
  "base_url",
  "description",
  "dev",
  "dev.host",
  "dev.port",
  "dir",
  "dir.content",
  "dir.output",
  "dir.static",
  "dir.templates",
  "name",
  "on_broken_links",
  "on_broken_links=error",
  "on_broken_links=warn",
  "search",
  "search.enabled",
  "search.typo_tolerance",
  "search.weights",
  "search.weights.html",
  "search.weights.jsonschema",
  "search.weights.markdown",
  "search.weights.openapi",
  "search.weights.proto",
  "stylesheet",
  "theme",
  "theme.dark_mode",
  "theme.dark_mode=auto",
  "theme.dark_mode=manual",
  "theme.dark_mode=off",
  "version",
]

type JsonSchema = {
  properties?: Record<string, JsonSchema>
  items?: JsonSchema
  enum?: string[]
}

function collectKeys(schema: JsonSchema, prefix: string): string[] {
  const keys = (schema.enum ?? []).map((value) => `${prefix}=${value}`)
  if (schema.items !== undefined) {
    keys.push(...collectKeys(schema.items, `${prefix}[]`))
  }
  for (const [name, child] of Object.entries(schema.properties ?? {})) {
    const key = prefix === "" ? name : `${prefix}.${name}`
    keys.push(key, ...collectKeys(child, key))
  }
  return keys
}

test("schemas/aid.schema.json keeps every published key and enum value", async () => {
  const schema = (await Bun.file(
    path.join(import.meta.dir, "../../schemas/aid.schema.json"),
  ).json()) as JsonSchema
  const actual = collectKeys(schema, "").toSorted()
  const removed = PUBLISHED_KEYS.filter((key) => !actual.includes(key))
  const added = actual.filter((key) => !PUBLISHED_KEYS.includes(key))
  expect({ removed, added }).toEqual({ removed: [], added: [] })
})
