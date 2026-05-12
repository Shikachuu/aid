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
})

describe("renderOpenApi", () => {
  async function renderFixture(name: string, body: string) {
    const sourcePath = await write(name, body)
    const route: Route = { source: sourcePath, path: "/api", kind: "openapi" }
    return renderOpenApi({ route, sourcePath })
  }

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

  test("emits a .json side-channel export with the normalized 3.1 doc", async () => {
    const page = await renderFixture(
      "api.yaml",
      `swagger: "2.0"\ninfo:\n  title: Old\n  version: "1"\npaths:\n  /x:\n    get:\n      responses:\n        "200":\n          description: ok\n`,
    )
    expect(page.exports.length).toBe(1)
    const exp = page.exports[0]
    if (!exp) throw new Error("missing export")
    expect(exp.suffix).toBe(".json")
    expect(exp.contentType).toBe("application/json")
    const parsed = JSON.parse(exp.body) as { openapi?: string; swagger?: string }
    expect(parsed.openapi).toMatch(/^3\.1/)
    expect(parsed.swagger).toBeUndefined()
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
  async function renderFixture(name: string, body: string) {
    const sourcePath = await write(name, body)
    const route: Route = { source: sourcePath, path: "/api", kind: "openapi" }
    return renderOpenApi({ route, sourcePath })
  }

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

  test("non-HTTP-verb path-item keys (e.g. `parameters`, `summary`) are skipped", async () => {
    const spec = [
      `openapi: "3.1.0"`,
      `info: { title: API, version: "1" }`,
      `paths:`,
      `  /pets:`,
      `    summary: A path-level summary`,
      `    parameters:`,
      `      - { name: shouldBeIgnored, in: query, schema: { type: string } }`,
      `    get:`,
      `      operationId: listPets`,
      `      responses: { "200": { description: ok } }`,
      ``,
    ].join("\n")
    const page = await renderFixture("api.yaml", spec)
    expect(page.searchTokens.extras.operationIds).toEqual(["listPets"])
    // The path-level summary belongs to the path item, not an operation, so it
    // must not leak into extras.summaries.
    expect(page.searchTokens.extras.summaries).toBeUndefined()
    // Same for path-level parameters — only per-operation params get bucketed.
    expect(page.searchTokens.extras.parameters).toBeUndefined()
  })
})
