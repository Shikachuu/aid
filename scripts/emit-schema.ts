#!/usr/bin/env bun
/**
 * Emit `schemas/aid.schema.json` from the Zod source of truth in
 * `src/core/config.ts`. This file is the LSP-facing artifact and must stay in
 * sync with the Zod schema — CI runs this script with `--check` to fail PRs
 * that drift.
 *
 * Usage:
 *   bun run scripts/emit-schema.ts          # write schemas/aid.schema.json
 *   bun run scripts/emit-schema.ts --check  # exit 1 if generated output differs from committed file
 */

import { resolve } from "node:path"
import { z } from "zod"
import { AidConfigSchema } from "../src/core/config"

const ROOT = resolve(import.meta.dir, "..")
const OUTPUT_PATH = resolve(ROOT, "schemas", "aid.schema.json")
const SCHEMA_ID = "https://aid.tools/schemas/v0/aid.schema.json"

const generated = generateJsonSchema()

const check = process.argv.includes("--check")
if (check) {
  const existing = await readExisting(OUTPUT_PATH)
  if (existing !== generated) {
    console.error(
      `[emit-schema] schemas/aid.schema.json is out of date.\n` +
        `Run 'bun run scripts/emit-schema.ts' and commit the result.`,
    )
    process.exit(1)
  }
  console.log("[emit-schema] schema is in sync.")
  process.exit(0)
}

await Bun.write(OUTPUT_PATH, generated)
console.log(`[emit-schema] wrote ${OUTPUT_PATH}`)

function generateJsonSchema(): string {
  // Zod v4: built-in toJSONSchema; fall back to the standalone helper if older
  const toJsonSchema = (z as unknown as { toJSONSchema?: (s: unknown) => unknown }).toJSONSchema
  if (typeof toJsonSchema !== "function") {
    throw new Error(
      "z.toJSONSchema is not available — upgrade `zod` to v4+ or wire in `zod-to-json-schema`.",
    )
  }
  const schema = toJsonSchema(AidConfigSchema) as Record<string, unknown>
  schema.$id = SCHEMA_ID
  schema.$schema = "https://json-schema.org/draft/2020-12/schema"
  schema.title = "aid project configuration"
  return `${JSON.stringify(schema, null, 2)}\n`
}

async function readExisting(path: string): Promise<string> {
  const file = Bun.file(path)
  if (!(await file.exists())) return ""
  return file.text()
}
