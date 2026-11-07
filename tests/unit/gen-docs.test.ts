import { describe, expect, test } from "bun:test"
import { lint } from "markdownlint/promise"
import {
  cliReference,
  code,
  configReference,
  configSchemaOpenApi,
  escapeMd,
  generateAll,
  inputSchema,
  schemaRows,
  typeLabel,
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

  test("escapeMd leaves URLs unescaped inside their code span", () => {
    expect(escapeMd("see https://x.dev/?a=1&b=<2> & more")).toBe(
      "see `https://x.dev/?a=1&b=<2>` &amp; more",
    )
  })

  test("code widens its backtick fence around backticks in the value", () => {
    expect(code("a|b")).toBe("`a\\|b`")
    expect(code("x`y")).toBe("``x`y``")
    expect(code("`x`")).toBe("`` `x` ``")
  })

  test("typeLabel names each member of a union instead of any", () => {
    expect(typeLabel({ anyOf: [{ type: "string" }, { type: "null" }] })).toBe("string or null")
    expect(typeLabel({ oneOf: [{ type: "string" }, { enum: ["a"] }] })).toBe("string or one of `a`")
  })

  test("the published schema is built from Zod, not copied from schemas/", async () => {
    const files = await generateAll()
    const published = files.find((f) => f.path === "site/static/schemas/aid.schema.json")
    expect(JSON.parse(published?.content ?? "")).toMatchObject({
      title: "aid project configuration",
    })
  })
})
