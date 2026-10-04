#!/usr/bin/env bun
import { resolve } from "node:path"
import { z } from "zod"
import { AidConfigSchema } from "../src/core/config"

const ROOT = resolve(import.meta.dir, "..")
const OUTPUT_PATH = resolve(ROOT, "schemas", "aid.schema.json")
const SCHEMA_ID = "https://aid.tools/schemas/v0/aid.schema.json"

const generated = generateJsonSchema()

const check = process.argv.includes("--check")
if (check) {
  const file = Bun.file(OUTPUT_PATH)
  const existing = (await file.exists()) ? await file.text() : ""
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
  const schema = {
    ...z.toJSONSchema(AidConfigSchema),
    $id: SCHEMA_ID,
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "aid project configuration",
  }
  return `${JSON.stringify(schema, null, 2)}\n`
}
