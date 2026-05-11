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
