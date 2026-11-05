import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import type { Route } from "../../../src/core/types"
import { renderOpenApi } from "../../../src/renderers/openapi"
import { parseOpenApi } from "../../../src/renderers/openapi/parser"
import { sniffOpenApi } from "../../../src/renderers/openapi/sniff"

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "aid-oapi-renderer-"))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

async function write(name: string, body: string): Promise<string> {
  const p = path.join(dir, name)
  await Bun.write(p, body)
  return p
}

async function renderFixture(name: string, body: string) {
  const sourcePath = await write(name, body)
  const route: Route = { source: sourcePath, path: "/api", kind: "openapi" }
  return renderOpenApi({ route, sourcePath })
}

describe("parseOpenApi", () => {
  test("upgrades Swagger 2.0 to OpenAPI 3.1", async () => {
    const swagger = `swagger: "2.0"\ninfo:\n  title: Old\n  version: "1"\npaths:\n  /x:\n    get:\n      responses:\n        "200":\n          description: ok\n`
    const { doc } = await parseOpenApi(swagger, "test.yaml")
    expect(typeof doc.openapi).toBe("string")
    expect(String(doc.openapi)).toMatch(/^3\.1/)
    expect(doc.swagger).toBeUndefined()
  })

  test("passes through an already-3.1 spec", async () => {
    const yaml = `openapi: "3.1.0"\ninfo:\n  title: New\n  version: "1"\npaths: {}\n`
    const { doc } = await parseOpenApi(yaml, "test.yaml")
    expect(String(doc.openapi)).toMatch(/^3\.1/)
    expect((doc.info as { title: string }).title).toBe("New")
  })

  test("a broken $ref becomes a warning instead of an error", async () => {
    const yaml = `openapi: "3.1.0"\ninfo:\n  title: Refs\n  version: "1"\npaths: {}\ncomponents:\n  schemas:\n    A:\n      $ref: "#/components/schemas/Missing"\n`
    const { warnings } = await parseOpenApi(yaml, "refs.yaml")
    expect(warnings).toEqual(["<root>: Can't resolve reference: #/components/schemas/Missing"])
  })

  test("non-mapping source throws with the source path in the message", async () => {
    await expect(parseOpenApi("- a\n- b\n", "/abs/spec.yaml")).rejects.toThrow(/\/abs\/spec\.yaml/)
  })
})

describe("sniffOpenApi", () => {
  test("accepts yaml with openapi: 3.x", async () => {
    const p = await write("a.yaml", `openapi: "3.1.0"\ninfo: {}\n`)
    expect(await sniffOpenApi(p)).toBe(true)
  })

  test("accepts yaml with swagger: 2.0", async () => {
    const p = await write("a.yaml", `swagger: "2.0"\ninfo: {}\n`)
    expect(await sniffOpenApi(p)).toBe(true)
  })

  test("accepts json with openapi key", async () => {
    const p = await write("a.json", `{"openapi": "3.1.0", "info": {}}`)
    expect(await sniffOpenApi(p)).toBe(true)
  })

  test("rejects yaml whose top-level key only looks like openapi", async () => {
    const p = await write("a.yaml", `openapi-spec-data: foo\nthings:\n  - 1\n`)
    expect(await sniffOpenApi(p)).toBe(false)
  })

  test("rejects unrelated json data", async () => {
    const p = await write("a.json", `{"products": [{"id": 1}]}`)
    expect(await sniffOpenApi(p)).toBe(false)
  })

  test("rejects an arbitrary yaml data file", async () => {
    const p = await write("a.yaml", `name: foo\nversion: 1\n`)
    expect(await sniffOpenApi(p)).toBe(false)
  })

  test("rejects json that has an openapi key only below the top level", async () => {
    const p = await write("a.json", `{"fixtures": [{"openapi": "3.1.0"}]}`)
    expect(await sniffOpenApi(p)).toBe(false)
  })

  test("accepts json that mentions openapi but does not parse, so the renderer reports it", async () => {
    const p = await write("a.json", `{"openapi": "3.1.0", `)
    expect(await sniffOpenApi(p)).toBe(true)
  })
})

describe("renderOpenApi", () => {
  test("names the file when a YAML alias refers to its own ancestor", async () => {
    const spec = `openapi: "3.1.0"\ninfo: { title: T, version: "1" }\npaths: {}\ncomponents:\n  schemas:\n    A: &a\n      properties:\n        self: *a\n`
    await expect(renderFixture("cyclic.yaml", spec)).rejects.toThrow(
      /aid: failed to parse OpenAPI source at .*cyclic\.yaml: a YAML alias refers to its own ancestor/,
    )
  })

  test("names the file when the spec does not parse", async () => {
    await expect(renderFixture("openapi.yaml", "openapi: [3.1.0\n")).rejects.toThrow(
      /aid: failed to parse OpenAPI source at .*openapi\.yaml: /,
    )
  })

  test("describes the page with the first paragraph of info.description", async () => {
    const page = await renderFixture(
      "openapi.yaml",
      'openapi: 3.1.0\ninfo:\n  title: T\n  version: "1"\n  description: |\n    First.\n\n    ## Later\npaths: {}\n',
    )
    expect(page.description).toBe("First.")
  })

  test("embeds a spec whose strings hold <!--<script and </script> without leaving the script element", async () => {
    const hostile = "<!--<script> x </script><b>after</b>"
    const page = await renderFixture(
      "openapi.json",
      JSON.stringify({
        openapi: "3.1.0",
        info: { title: "T", version: "1", description: hostile },
        paths: {},
      }),
    )
    const body = page.html.slice(page.html.indexOf('id="aid-openapi-spec">'))
    const inner = body.slice(body.indexOf(">") + 1, body.indexOf("</script>"))
    expect(inner).not.toContain("<")
    expect(JSON.parse(inner).info.description).toBe(hostile)
    expect(body.slice(body.indexOf("</script>"))).not.toContain("<b>after</b>")
  })

  test("info.title becomes the page title and is in the rendered <h1>", async () => {
    const page = await renderFixture(
      "api.yaml",
      `openapi: "3.1.0"\ninfo:\n  title: Pet Store\n  version: "1"\npaths: {}\n`,
    )
    expect(page.searchTokens.title).toBe("Pet Store")
    expect(page.html).toContain("<h1>Pet Store</h1>")
  })

  test("filename basename is the title when info.title is missing", async () => {
    const page = await renderFixture(
      "events.yaml",
      `openapi: "3.1.0"\ninfo:\n  version: "1"\npaths: {}\n`,
    )
    expect(page.searchTokens.title).toBe("events")
  })

  test("embeds the spec as a JSON script and emits an aid-page-openapi container", async () => {
    const page = await renderFixture(
      "api.yaml",
      `openapi: "3.1.0"\ninfo:\n  title: T\n  version: "1"\npaths: {}\n`,
    )
    expect(page.html).toContain('class="aid-page aid-page-openapi"')
    expect(page.html).toContain('id="aid-openapi-spec"')
    expect(page.html).toContain('id="aid-openapi-mount"')
    expect(page.html).toMatch(/<script type="application\/json" id="aid-openapi-spec">/)
  })

  test("embeds and exports a Swagger 2.0 source as the normalized 3.1 doc", async () => {
    const page = await renderFixture(
      "api.yaml",
      `swagger: "2.0"\ninfo:\n  title: Old\n  version: "1"\npaths:\n  /x:\n    get:\n      responses:\n        "200":\n          description: ok\n`,
    )
    expect(page.exports.length).toBe(1)
    const exp = page.exports[0]
    if (!exp) {
      throw new Error("missing export")
    }
    expect(exp.suffix).toBe(".json")
    const parsed = JSON.parse(exp.body) as { openapi?: string; swagger?: string }
    expect(parsed.openapi).toMatch(/^3\.1/)
    expect(parsed.swagger).toBeUndefined()
    const embedded = page.html.match(
      /<script type="application\/json" id="aid-openapi-spec">([\s\S]*?)<\/script>/,
    )
    expect(JSON.parse(embedded?.[1] ?? "{}")).toEqual(parsed)
  })

  test("hasMermaid: false, hasOpenApi: true", async () => {
    const page = await renderFixture(
      "api.yaml",
      `openapi: "3.1.0"\ninfo:\n  title: T\n  version: "1"\npaths: {}\n`,
    )
    expect(page.hasMermaid).toBe(false)
    expect(page.hasOpenApi).toBe(true)
  })
})

describe("renderOpenApi — search tokens", () => {
  test("extras: empty spec produces an empty extras dict (title-only index entry)", async () => {
    const page = await renderFixture(
      "api.yaml",
      `openapi: "3.1.0"\ninfo:\n  title: T\n  version: "1"\npaths: {}\n`,
    )
    expect(page.searchTokens.extras).toEqual({})
  })

  test("extras.operationIds collects operationId from each verb under each path", async () => {
    const spec = [
      `openapi: "3.1.0"`,
      `info:`,
      `  title: API`,
      `  version: "1"`,
      `paths:`,
      `  /pets:`,
      `    get:`,
      `      operationId: listPets`,
      `      responses: { "200": { description: ok } }`,
      `    post:`,
      `      operationId: createPet`,
      `      responses: { "201": { description: ok } }`,
      `  /pets/{id}:`,
      `    get:`,
      `      operationId: getPet`,
      `      responses: { "200": { description: ok } }`,
      ``,
    ].join("\n")
    const page = await renderFixture("api.yaml", spec)
    expect(page.searchTokens.extras.operationIds).toEqual(["listPets", "createPet", "getPet"])
  })

  test("extras.paths collects each path string exactly once", async () => {
    const spec = [
      `openapi: "3.1.0"`,
      `info: { title: API, version: "1" }`,
      `paths:`,
      `  /pets:`,
      `    get: { responses: { "200": { description: ok } } }`,
      `  /pets/{id}:`,
      `    get: { responses: { "200": { description: ok } } }`,
      ``,
    ].join("\n")
    const page = await renderFixture("api.yaml", spec)
    expect(page.searchTokens.extras.paths).toEqual(["/pets", "/pets/{id}"])
  })

  test("extras.summaries collects operation summaries", async () => {
    const spec = [
      `openapi: "3.1.0"`,
      `info: { title: API, version: "1" }`,
      `paths:`,
      `  /pets:`,
      `    get:`,
      `      summary: List all pets`,
      `      responses: { "200": { description: ok } }`,
      ``,
    ].join("\n")
    const page = await renderFixture("api.yaml", spec)
    expect(page.searchTokens.extras.summaries).toEqual(["List all pets"])
  })

  test("extras.parameters collects parameter names, deduplicated across operations", async () => {
    const spec = [
      `openapi: "3.1.0"`,
      `info: { title: API, version: "1" }`,
      `paths:`,
      `  /pets/{petId}:`,
      `    get:`,
      `      parameters:`,
      `        - { name: petId, in: path, required: true, schema: { type: string } }`,
      `        - { name: tag, in: query, schema: { type: string } }`,
      `      responses: { "200": { description: ok } }`,
      `    delete:`,
      `      parameters:`,
      `        - { name: petId, in: path, required: true, schema: { type: string } }`,
      `      responses: { "204": { description: ok } }`,
      ``,
    ].join("\n")
    const page = await renderFixture("api.yaml", spec)
    expect(page.searchTokens.extras.parameters).toEqual(["petId", "tag"])
  })

  test("extras.schemas collects component schema names", async () => {
    const spec = [
      `openapi: "3.1.0"`,
      `info: { title: API, version: "1" }`,
      `paths: {}`,
      `components:`,
      `  schemas:`,
      `    Pet: { type: object }`,
      `    Owner: { type: object }`,
      ``,
    ].join("\n")
    const page = await renderFixture("api.yaml", spec)
    expect(page.searchTokens.extras.schemas).toEqual(["Pet", "Owner"])
  })

  test("path-item parameters are indexed, other non-verb keys are skipped", async () => {
    const spec = [
      `openapi: "3.1.0"`,
      `info: { title: API, version: "1" }`,
      `paths:`,
      `  /pets:`,
      `    summary: A path-level summary`,
      `    parameters:`,
      `      - { name: pathLevel, in: query, schema: { type: string } }`,
      `    get:`,
      `      operationId: listPets`,
      `      responses: { "200": { description: ok } }`,
      ``,
    ].join("\n")
    const page = await renderFixture("api.yaml", spec)
    expect(page.searchTokens.extras.operationIds).toEqual(["listPets"])
    expect(page.searchTokens.extras.summaries).toBeUndefined()
    expect(page.searchTokens.extras.parameters).toEqual(["pathLevel"])
  })

  test("webhooks and their operations are indexed", async () => {
    const spec = [
      `openapi: "3.1.0"`,
      `info: { title: API, version: "1" }`,
      `webhooks:`,
      `  newPet:`,
      `    post:`,
      `      operationId: onNewPet`,
      `      parameters: [{ name: signature, in: header, schema: { type: string } }]`,
      `      responses: { "200": { description: ok } }`,
      ``,
    ].join("\n")
    const page = await renderFixture("hooks.yaml", spec)
    expect(page.searchTokens.extras.webhooks).toEqual(["newPet"])
    expect(page.searchTokens.extras.operationIds).toEqual(["onNewPet"])
    expect(page.searchTokens.extras.parameters).toEqual(["signature"])
  })

  test("a broken $ref becomes an openapi/ref warning diagnostic", async () => {
    const page = await renderFixture(
      "refs.yaml",
      `openapi: "3.1.0"\ninfo:\n  title: Refs\n  version: "1"\npaths: {}\ncomponents:\n  schemas:\n    A:\n      $ref: "#/components/schemas/Missing"\n`,
    )
    expect(page.diagnostics).toEqual([
      {
        file: path.join(dir, "refs.yaml"),
        severity: "warn",
        code: "openapi/ref",
        message: "<root>: Can't resolve reference: #/components/schemas/Missing",
      },
    ])
  })
})
