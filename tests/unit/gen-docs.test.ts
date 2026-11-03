import { describe, expect, test } from "bun:test"
import { lint } from "markdownlint/promise"
import {
  cliReference,
  configReference,
  configSchemaOpenApi,
  escapeMd,
  generateAll,
  inputSchema,
  schemaRows,
} from "../../scripts/gen-docs"
import { main } from "../../src/cli/main"
import { AidConfigSchema } from "../../src/core/config"
import { markdownlintDefault } from "../../src/lint/configs/markdownlint.default"

describe("gen-docs", () => {
  test("the configuration page lists every aid.yaml key", () => {
    const page = configReference()
    for (const row of schemaRows(inputSchema(AidConfigSchema))) {
      expect(page).toContain(`\`${row.key}\``)
    }
  })

  test("the CLI page has a section for every subcommand", async () => {
    const page = await cliReference()
    for (const name of Object.keys(main.subCommands ?? {})) {
      expect(page).toContain(`## \`aid ${name}\``)
    }
  })

  test("every generated markdown page passes the bundled markdownlint config", async () => {
    const files = (await generateAll()).filter((f) => f.path.endsWith(".md"))
    const strings = Object.fromEntries(files.map((f) => [f.path, f.content]))
    const results = await lint({ strings, config: markdownlintDefault })
    expect(Object.values(results).flat()).toEqual([])
  })

  test("the schema page is an OpenAPI document the router picks up", () => {
    expect(configSchemaOpenApi()).toMatch(/^openapi: ['"]?3\.1\.0/m)
    expect(configSchemaOpenApi()).toContain("AidConfig:")
  })

  test("escapeMd neutralises HTML, pipes, and bare URLs", () => {
    expect(escapeMd('<meta name="x"> a|b https://x.dev/y.')).toBe(
      '&lt;meta name="x"&gt; a\\|b `https://x.dev/y.`',
    )
  })
})
