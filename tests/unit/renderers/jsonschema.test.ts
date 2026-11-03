import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import type { RouteIndex } from "../../../src/core/links"
import type { Route } from "../../../src/core/types"
import { renderJsonSchema } from "../../../src/renderers/jsonschema"
import {
  buildSchemaDocument,
  type SchemaNode,
  typeLabel,
} from "../../../src/renderers/jsonschema/model"
import { sniffJsonSchema } from "../../../src/renderers/jsonschema/sniff"

const DIALECT = "https://json-schema.org/draft/2020-12/schema"

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "aid-jsonschema-"))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

async function write(name: string, body: string): Promise<string> {
  const p = path.join(dir, name)
  await Bun.write(p, body)
  return p
}

async function renderFixture(name: string, schema: unknown, index?: RouteIndex) {
  const sourcePath = await write(name, JSON.stringify(schema))
  const route: Route = { source: sourcePath, path: "/user", kind: "jsonschema" }
  return renderJsonSchema({ route, sourcePath, index })
}

function build(schema: unknown) {
  return buildSchemaDocument(schema, { sourcePath: path.join(dir, "s.json") })
}

function field(node: SchemaNode, name: string): SchemaNode {
  const found = node.properties.find((p) => p.label === name)
  if (!found) {
    throw new Error(`no field ${name}`)
  }
  return found
}

describe("sniffJsonSchema", () => {
  test("accepts json with a json-schema.org $schema", async () => {
    expect(await sniffJsonSchema(await write("a.json", `{"$schema": "${DIALECT}"}`))).toBe(true)
  })

  test("accepts yaml with a draft-07 $schema", async () => {
    const p = await write(
      "a.yaml",
      `$schema: "http://json-schema.org/draft-07/schema#"\ntype: object\n`,
    )
    expect(await sniffJsonSchema(p)).toBe(true)
  })

  test("rejects a config file whose $schema points elsewhere", async () => {
    const p = await write(
      "biome.json",
      `{"$schema": "https://biomejs.dev/schemas/2.4.15/schema.json"}`,
    )
    expect(await sniffJsonSchema(p)).toBe(false)
  })

  test("rejects json without $schema", async () => {
    expect(await sniffJsonSchema(await write("a.json", `{"type": "object"}`))).toBe(false)
  })
})

describe("sniffJsonSchema top-level check", () => {
  test("rejects json data that only nests a schema fragment", async () => {
    const p = await write("data.json", JSON.stringify({ items: [{ $schema: DIALECT }] }))
    expect(await sniffJsonSchema(p)).toBe(false)
  })

  test("rejects yaml data that nests a schema in a flow mapping", async () => {
    const p = await write("data.yaml", `{\n"items": [{\n"$schema": "${DIALECT}"\n}]\n}\n`)
    expect(await sniffJsonSchema(p)).toBe(false)
  })

  test("accepts yaml with a quoted $schema key", async () => {
    expect(await sniffJsonSchema(await write("a.yaml", `"$schema": "${DIALECT}"\n`))).toBe(true)
  })

  test("matches uppercase extensions", async () => {
    expect(await sniffJsonSchema(await write("A.JSON", `{"$schema": "${DIALECT}"}`))).toBe(true)
    expect(await sniffJsonSchema(await write("B.YAML", `$schema: "${DIALECT}"\n`))).toBe(true)
  })

  test("rejects a top-level $schema that is not a json-schema.org string", async () => {
    const p = await write("a.json", `{"$schema": 7, "x": {"$schema": "${DIALECT}"}}`)
    expect(await sniffJsonSchema(p)).toBe(false)
  })

  test("accepts a one-line flow-style yaml schema", async () => {
    const p = await write("a.yaml", `{"$schema": "${DIALECT}", "type": "object"}\n`)
    expect(await sniffJsonSchema(p)).toBe(true)
  })

  test("accepts json that escapes the slashes in $schema", async () => {
    const p = await write(
      "a.json",
      `{"$schema": "http:\\/\\/json-schema.org\\/draft-07\\/schema#"}`,
    )
    expect(await sniffJsonSchema(p)).toBe(true)
  })

  test("accepts a .yml schema", async () => {
    expect(await sniffJsonSchema(await write("a.yml", `$schema: "${DIALECT}"\n`))).toBe(true)
  })

  test("accepts a file that fails to parse, so the renderer reports the error", async () => {
    expect(await sniffJsonSchema(await write("a.json", `{"$schema": "${DIALECT}",`))).toBe(true)
  })
})

describe("buildSchemaDocument", () => {
  test("marks required properties and infers types", () => {
    const doc = build({
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string" },
        role: { enum: ["a", "b"] },
        n: { type: ["integer", "null"] },
      },
    })
    expect(field(doc.root, "id").required).toBe(true)
    expect(field(doc.root, "role").required).toBe(false)
    expect(field(doc.root, "role").types).toEqual(["string"])
    expect(field(doc.root, "n").types).toEqual(["integer"])
    expect(field(doc.root, "n").nullable).toBe(true)
  })

  test("expands a local $ref inline and keeps the target name as the type", () => {
    const doc = build({
      properties: { home: { $ref: "#/$defs/Address", description: "Where they live." } },
      $defs: { Address: { type: "object", properties: { city: { type: "string" } } } },
    })
    const home = field(doc.root, "home")
    expect(typeLabel(home)).toBe("Address")
    expect(home.ref?.href).toBeUndefined()
    expect(home.description).toBe("Where they live.")
    expect(field(home, "city").elementId).toBe("prop-home.city")
    expect(doc.definitions.map((d) => d.elementId)).toEqual(["def-Address"])
  })

  test("a recursive $ref links to its definition instead of expanding forever", () => {
    const doc = build({
      $ref: "#/$defs/Node",
      $defs: {
        Node: { type: "object", properties: { next: { $ref: "#/$defs/Node" } } },
      },
    })
    const next = field(doc.root, "next")
    expect(next.ref).toEqual({ label: "Node", href: "#def-Node" })
    expect(next.properties).toEqual([])
    expect(field(doc.definitions[0] as SchemaNode, "next").ref?.href).toBe("#def-Node")
  })

  test("a $ref to the root links to the top of the page", () => {
    const doc = build({ title: "User", properties: { manager: { $ref: "#" } } })
    expect(field(doc.root, "manager").ref).toEqual({ label: "User", href: "#top" })
  })

  test("resolves draft-07 definitions, $anchor, and embedded $id refs", () => {
    const doc = build({
      $id: "https://example.com/root.json",
      properties: {
        a: { $ref: "#/definitions/A" },
        b: { $ref: "#bee" },
        c: { $ref: "c.json" },
      },
      definitions: {
        A: { type: "string" },
        B: { $anchor: "bee", type: "integer" },
        C: { $id: "c.json", type: "boolean" },
      },
    })
    expect(field(doc.root, "a").types).toEqual(["string"])
    expect(field(doc.root, "b").types).toEqual(["integer"])
    expect(field(doc.root, "c").types).toEqual(["boolean"])
    expect(doc.warnings).toEqual([])
  })

  test("an unresolvable $ref keeps its raw name and adds a warning", () => {
    const doc = build({ properties: { x: { $ref: "#/$defs/Missing" } } })
    expect(typeLabel(field(doc.root, "x"))).toBe("Missing")
    expect(doc.warnings).toHaveLength(1)
    expect(doc.warnings[0]).toContain('"#/$defs/Missing"')
  })

  test("merges an allOf of objects into one field list", () => {
    const doc = build({
      allOf: [
        { $ref: "#/$defs/Base" },
        { type: "object", required: ["b"], properties: { b: { type: "number" } } },
      ],
      $defs: { Base: { type: "object", required: ["a"], properties: { a: { type: "string" } } } },
    })
    expect(doc.root.variants).toEqual([])
    expect(doc.root.properties.map((p) => [p.label, p.required])).toEqual([
      ["a", true],
      ["b", true],
    ])
  })

  test("an allOf with conflicting keywords stays a variant group", () => {
    const doc = build({ allOf: [{ type: "string" }, { type: "number" }] })
    expect(doc.root.variants.map((g) => g.kind)).toEqual(["allOf"])
  })

  test("oneOf options are labelled by title, ref name, or position", () => {
    const doc = build({
      oneOf: [{ title: "Cat", type: "object" }, { $ref: "#/$defs/Dog" }, { type: "null" }],
      $defs: { Dog: { type: "object" } },
    })
    expect(doc.root.variants[0]?.options.map((o) => o.label)).toEqual(["Cat", "Dog", "Option 3"])
  })

  test("arrays and tuples get readable type labels", () => {
    const doc = build({
      properties: {
        tags: { type: "array", items: { type: "string" } },
        pair: { type: "array", prefixItems: [{ type: "string" }, { type: "integer" }] },
        old: { type: "array", items: [{ type: "boolean" }] },
      },
    })
    expect(typeLabel(field(doc.root, "tags"))).toBe("array<string>")
    expect(typeLabel(field(doc.root, "pair"))).toBe("[string, integer]")
    expect(typeLabel(field(doc.root, "old"))).toBe("[boolean]")
  })

  test("keywords without a dedicated display land in constraints, in source order", () => {
    const doc = build({
      properties: {
        name: {
          type: "string",
          minLength: 1,
          pattern: "^[a-z]+$",
          "x-internal": true,
          $comment: "note",
          title: "Name",
        },
        map: { type: "object", additionalProperties: false },
      },
    })
    expect(field(doc.root, "name").constraints).toEqual([
      ["minLength", 1],
      ["pattern", "^[a-z]+$"],
      ["x-internal", true],
      ["$comment", "note"],
    ])
    expect(field(doc.root, "map").constraints).toEqual([["additionalProperties", false]])
  })

  test("pattern and additional properties become child fields", () => {
    const doc = build({
      type: "object",
      patternProperties: { "^x-": { type: "string" } },
      additionalProperties: { type: "integer" },
    })
    expect(doc.root.properties.map((p) => [p.kind, p.label])).toEqual([
      ["pattern", "^x-"],
      ["additional", "*"],
    ])
  })

  test("duplicate element ids get a numeric suffix", () => {
    const doc = build({ properties: { "a b": { type: "string" }, "a-b": { type: "string" } } })
    expect(doc.root.properties.map((p) => p.elementId)).toEqual(["prop-a-b", "prop-a-b-2"])
  })

  test("boolean subschemas read as any and never", () => {
    const doc = build({ properties: { yes: true, no: false } })
    expect(doc.root.properties.map(typeLabel)).toEqual(["any", "never"])
  })

  test("boolean definitions whose names slug alike get distinct ids", () => {
    const doc = build({ $defs: { "a b": true, "a-b": true } })
    expect(doc.definitions.map((d) => d.elementId)).toEqual(["def-a-b", "def-a-b-2"])
  })

  test("an allOf that refers back to itself stays a variant group instead of recursing", () => {
    const doc = build({
      properties: { x: { allOf: [{ $ref: "#/$defs/A" }] } },
      $defs: {
        A: { allOf: [{ $ref: "#/$defs/B" }] },
        B: { allOf: [{ $ref: "#/$defs/A" }] },
      },
    })
    expect(field(doc.root, "x").variants.map((g) => g.kind)).toEqual(["allOf"])
    expect(doc.warnings).toEqual([])
  })

  test("the same member twice in one allOf still merges", () => {
    const doc = build({
      allOf: [{ $ref: "#/$defs/A" }, { $ref: "#/$defs/A" }],
      $defs: { A: { type: "object", properties: { a: { type: "string" } } } },
    })
    expect(doc.root.properties.map((p) => p.label)).toEqual(["a"])
  })

  test("deep non-recursive nesting stops at the depth cap", () => {
    let schema: Record<string, unknown> = { type: "string" }
    for (let i = 0; i < 100; i++) {
      schema = { type: "object", properties: { n: schema } }
    }
    const doc = build(schema)
    let depth = 0
    for (let node = doc.root; node.properties[0]; node = node.properties[0]) {
      depth++
    }
    expect(depth).toBeGreaterThan(0)
    expect(depth).toBeLessThan(100)
  })

  test("a remote $ref links to its URL and warns", () => {
    const doc = build({
      properties: { geo: { $ref: "https://example.com/geo.json#/$defs/Point" } },
    })
    expect(field(doc.root, "geo").ref).toEqual({
      label: "Point",
      href: "https://example.com/geo.json#/$defs/Point",
    })
    expect(doc.warnings).toHaveLength(1)
  })

  test("properties and required next to a $ref extend the target instead of replacing it", () => {
    const doc = build({
      $ref: "#/$defs/Base",
      properties: { extra: { type: "string" } },
      required: ["extra"],
      $defs: { Base: { type: "object", required: ["id"], properties: { id: { type: "string" } } } },
    })
    expect(doc.root.properties.map((p) => [p.label, p.required])).toEqual([
      ["id", true],
      ["extra", true],
    ])
    expect(doc.examples).toEqual([{ id: "string", extra: "string" }])
  })

  test("a literal dotted property name and a nested path get different ids", () => {
    const doc = build({
      properties: { "a.b": { type: "string" }, a: { properties: { b: { type: "string" } } } },
    })
    expect(doc.root.properties.map((p) => p.elementId)).toEqual(["prop-a-b", "prop-a"])
    expect(field(field(doc.root, "a"), "b").elementId).toBe("prop-a.b")
  })

  test("a root that is only a $ref takes its title from the target", () => {
    const doc = build({
      $ref: "#/definitions/Config",
      definitions: { Config: { title: "Config" } },
    })
    expect(doc.title).toBe("Config")
  })

  test("an allOf member under a different $id base is not merged", () => {
    const doc = build({
      $id: "https://example.com/root.json",
      allOf: [{ $ref: "other.json" }],
      $defs: {
        Other: { $id: "other.json", type: "object", properties: { a: { $ref: "#/$defs/X" } } },
      },
    })
    expect(doc.root.variants.map((g) => g.kind)).toEqual(["allOf"])
  })

  test("a __proto__ property survives an allOf merge", () => {
    const doc = build({ allOf: [JSON.parse('{"properties": {"__proto__": {"type": "string"}}}')] })
    expect(doc.root.properties.map((p) => p.label)).toEqual(["__proto__"])
  })

  test("a property re-declared in an allOf keeps both declarations", () => {
    const doc = build({
      allOf: [{ $ref: "#/$defs/Base" }, { properties: { id: { description: "Override." } } }],
      $defs: { Base: { type: "object", properties: { id: { type: "string", format: "uuid" } } } },
    })
    const id = field(doc.root, "id")
    expect([id.types, id.format, id.description]).toEqual([["string"], "uuid", "Override."])
    expect(doc.examples).toEqual([{ id: "123e4567-e89b-12d3-a456-426614174000" }])
  })

  test("a property re-declared next to a $ref keeps both declarations", () => {
    const doc = build({
      $ref: "#/$defs/Base",
      properties: { id: { readOnly: true } },
      $defs: { Base: { type: "object", properties: { id: { type: "integer" } } } },
    })
    const id = field(doc.root, "id")
    expect([id.types, id.readOnly]).toEqual([["integer"], true])
  })

  test("a field at the depth cap lists its nested keywords as constraints", () => {
    let schema: Record<string, unknown> = { type: "string" }
    for (let i = 0; i < 40; i++) {
      schema = { type: "object", properties: { n: schema } }
    }
    let node = build(schema).root
    while (node.properties[0]) {
      node = node.properties[0]
    }
    expect(node.constraints.map(([key]) => key)).toEqual(["properties"])
  })

  test("a null-only type reads as null, also inside an anyOf", () => {
    const doc = build({
      properties: {
        nothing: { type: "null" },
        maybe: { anyOf: [{ type: "string" }, { const: null }] },
      },
    })
    expect(typeLabel(field(doc.root, "nothing"))).toBe("null")
    expect(field(doc.root, "nothing").nullable).toBe(false)
    expect(typeLabel(field(doc.root, "maybe"))).toBe("string | null")
  })

  test("empty enum and oneOf arrays render nothing", () => {
    const doc = build({ properties: { x: { enum: [], oneOf: [] } } })
    expect(field(doc.root, "x").enum).toBeUndefined()
    expect(field(doc.root, "x").variants).toEqual([])
    expect(typeLabel(field(doc.root, "x"))).toBe("any")
  })

  test("required names with no shown property land in constraints", () => {
    const doc = build({
      properties: { email: { type: "string" }, phone: { type: "string" } },
      anyOf: [{ required: ["email"] }, { required: ["phone"] }],
    })
    expect(doc.root.variants[0]?.options.map((o) => o.constraints)).toEqual([
      [["required", ["email"]]],
      [["required", ["phone"]]],
    ])
  })

  test("a $ref to a missing definition named like an Object method stays unresolved", () => {
    const doc = build({ properties: { x: { $ref: "#/$defs/constructor" } }, $defs: {} })
    expect(doc.warnings).toHaveLength(1)
  })

  test("an allOf next to a $ref adds to the target's allOf", () => {
    const doc = build({
      $ref: "#/$defs/T",
      allOf: [{ properties: { b: { type: "string" } } }],
      $defs: { T: { allOf: [{ properties: { a: { type: "string" } } }] } },
    })
    expect(doc.root.properties.map((p) => p.label)).toEqual(["a", "b"])
  })

  test("a recursive definition wrapped in allOf terminates with links back to it", () => {
    const wrap = { allOf: [{ $ref: "#/$defs/Node" }] }
    const doc = build({
      properties: { tree: { allOf: [{ $ref: "#/$defs/Node" }], description: "Root." } },
      $defs: { Node: { type: "object", properties: { left: wrap, right: wrap } } },
    })
    const tree = field(doc.root, "tree")
    expect(tree.properties.map((p) => p.label)).toEqual(["left", "right"])
    const left = field(tree, "left")
    expect(left.properties).toEqual([])
    expect(left.variants[0]?.options[0]?.ref).toEqual({ label: "Node", href: "#def-Node" })
  })

  test("a JSON pointer with an empty array index stays unresolved", () => {
    const doc = build({ allOf: [{ type: "string" }], properties: { x: { $ref: "#/allOf/" } } })
    expect(doc.warnings).toHaveLength(1)
  })

  test("a field at the depth cap keeps its whole required list", () => {
    let schema: Record<string, unknown> = { type: "string" }
    for (let i = 0; i < 40; i++) {
      schema = { type: "object", required: ["n"], properties: { n: schema } }
    }
    let node = build(schema).root
    while (node.properties[0]) {
      node = node.properties[0]
    }
    expect(node.constraints.map(([key]) => key)).toEqual(["required", "properties"])
  })

  test("allOf-wrapped refs fanning out across nested definitions stay within the node budget", () => {
    const defs: Record<string, unknown> = {}
    for (let level = 0; level < 6; level++) {
      const properties: Record<string, unknown> = {}
      for (let p = 0; p < 10; p++) {
        properties[`p${p}`] =
          level === 5 ? { type: "string" } : { allOf: [{ $ref: `#/definitions/L${level + 1}` }] }
      }
      defs[`L${level}`] = { type: "object", properties }
    }
    const started = performance.now()
    const doc = build({ allOf: [{ $ref: "#/definitions/L0" }], definitions: defs })
    expect(performance.now() - started).toBeLessThan(2000)
    let count = 0
    const walk = (n: SchemaNode): void => {
      count++
      for (const c of [...n.properties, ...n.variants.flatMap((g) => g.options)]) {
        walk(c)
      }
    }
    walk(doc.root)
    expect(count).toBeLessThan(10_000)
  })

  test("non-ASCII definition names keep distinct ids", () => {
    const doc = build({ $defs: { 名前: { type: "string" }, 住所: { type: "string" } } })
    expect(doc.definitions.map((d) => d.elementId)).toEqual(["def-名前", "def-住所"])
  })

  test("an allOf that does not merge reads as an intersection, with grouped unions", () => {
    const doc = build({
      properties: {
        pet: {
          allOf: [{ $ref: "#/$defs/Base" }, { oneOf: [{ type: "string" }, { type: "integer" }] }],
        },
      },
      $defs: { Base: { type: "object" } },
    })
    expect(typeLabel(field(doc.root, "pet"))).toBe("Base & (string | integer)")
  })

  test("a tuple with a rest schema shows the rest type", () => {
    const doc = build({
      properties: {
        modern: { type: "array", prefixItems: [{ type: "string" }], items: { type: "integer" } },
        draft07: {
          type: "array",
          items: [{ type: "string" }],
          additionalItems: { type: "boolean" },
        },
      },
    })
    expect(typeLabel(field(doc.root, "modern"))).toBe("[string, ...integer]")
    expect(typeLabel(field(doc.root, "draft07"))).toBe("[string, ...boolean]")
  })

  test("names with combining marks keep them in their ids", () => {
    const doc = build({ properties: { नाम: { type: "string" } } })
    expect(doc.root.properties[0]?.elementId).toBe("prop-नाम")
  })

  test("throws on a root that is not a schema", () => {
    expect(() => build([1, 2])).toThrow(/not an object or boolean schema/)
  })
})

describe("buildSchemaDocument examples", () => {
  test("uses the root examples when present", () => {
    const doc = build({ type: "object", examples: [{ a: 1 }, { a: 2 }] })
    expect(doc.examples).toEqual([{ a: 1 }, { a: 2 }])
  })

  test("synthesizes one from field examples, defaults, enums, and formats", () => {
    const doc = build({
      type: "object",
      properties: {
        name: { type: "string", examples: ["ada"] },
        role: { enum: ["admin", "member"] },
        level: { type: "integer", default: 3 },
        at: { type: "string", format: "date-time" },
        tags: { type: "array", items: { type: "string" } },
        ok: { type: "boolean" },
        score: { type: "number", minimum: 5 },
      },
    })
    expect(doc.examples).toEqual([
      {
        name: "ada",
        role: "admin",
        level: 3,
        at: "2024-01-01T00:00:00Z",
        tags: ["string"],
        ok: true,
        score: 5,
      },
    ])
  })

  test("example synthesis stops on deep non-recursive nesting", () => {
    let schema: Record<string, unknown> = { type: "string" }
    for (let i = 0; i < 50; i++) {
      schema = { type: "object", properties: { n: schema } }
    }
    expect(JSON.stringify(build(schema).examples).length).toBeLessThan(200)
  })

  test("numbers with only an exclusiveMinimum sit just above it", () => {
    expect(build({ type: "integer", exclusiveMinimum: 4 }).examples).toEqual([5])
  })

  test("example synthesis stops after its value budget on wide ref-heavy schemas", () => {
    const defs: Record<string, unknown> = {}
    for (let d = 0; d < 10; d++) {
      const properties: Record<string, unknown> = {}
      for (let p = 0; p < 30; p++) {
        properties[`p${p}`] = { $ref: `#/$defs/D${(d + 1) % 10}` }
      }
      defs[`D${d}`] = { type: "object", properties }
    }
    const example = build({ $ref: "#/$defs/D0", $defs: defs }).examples
    expect(JSON.stringify(example).length).toBeLessThan(200_000)
  })

  test("a __proto__ property keeps its place in the synthesized example", () => {
    const doc = build(
      JSON.parse('{"type": "object", "properties": {"__proto__": {"type": "string"}}}'),
    )
    expect(JSON.stringify(doc.examples[0])).toBe('{"__proto__":"string"}')
  })

  test("a format named like an Object method falls back to a plain string", () => {
    expect(build({ type: "string", format: "constructor" }).examples).toEqual(["string"])
  })

  test("stops at a recursive $ref", () => {
    const doc = build({
      type: "object",
      properties: { label: { type: "string" }, child: { $ref: "#" } },
    })
    expect(doc.examples).toEqual([{ label: "string" }])
  })
})

describe("renderJsonSchema", () => {
  const schema = {
    $schema: DIALECT,
    title: "User",
    description: "An account.\n\nSecond paragraph.",
    type: "object",
    required: ["id"],
    properties: {
      id: {
        type: "string",
        format: "uuid",
        description: "Use `id` <script>alert(1)</script>here.",
      },
      name: { type: "string", minLength: 1 },
    },
    $defs: { Address: { type: "object" } },
  }

  test("renders the title, chips, constraints, example, and definitions", async () => {
    const page = await renderFixture("user.json", schema)
    expect(page.html).toContain('class="aid-page aid-page-jsonschema"')
    expect(page.html).toContain("<h1>User</h1>")
    expect(page.html).toContain('<details class="aid-schema-field" id="prop-id" open>')
    expect(page.html).toContain(
      '<span class="aid-schema-chip aid-schema-chip-required">required</span>',
    )
    expect(page.html).toContain('<span class="aid-schema-chip aid-schema-chip-format">uuid</span>')
    expect(page.html).toContain(
      '<span class="aid-schema-chip aid-schema-chip-dialect">JSON Schema 2020-12</span>',
    )
    expect(page.html).toContain("All schema constraints and annotations")
    expect(page.html).toContain('<h2 id="schema-example">Schema example</h2>')
    expect(page.html).toContain('<section class="aid-schema-definition" id="def-Address">')
  })

  test("renders description markdown and shows raw HTML as escaped text", async () => {
    const page = await renderFixture("user.json", schema)
    expect(page.html).toContain("<code>id</code>")
    expect(page.html).not.toContain("<script>alert(1)</script>")
    expect(page.html).toContain("&#x3C;script>alert(1)")
  })

  test("angle-bracket placeholders in a description stay readable", async () => {
    const page = await renderFixture("user.json", {
      $schema: DIALECT,
      description: "Address as <host>:<port>.",
    })
    expect(page.html).toContain("Address as &#x3C;host>:&#x3C;port>.")
  })

  test("exports the schema as JSON, including YAML sources", async () => {
    const sourcePath = await write("user.yaml", `$schema: "${DIALECT}"\ntitle: Y\ntype: object\n`)
    const route: Route = { source: sourcePath, path: "/user", kind: "jsonschema" }
    const page = await renderJsonSchema({ route, sourcePath })
    expect(page.exports.map((e) => e.suffix)).toEqual([".json"])
    expect(JSON.parse(page.exports[0]?.body ?? "")).toEqual({
      $schema: DIALECT,
      title: "Y",
      type: "object",
    })
    expect(page.html).toContain('data-machine-url="/user.json"')
  })

  test("falls back to the file name for the title and uses the first paragraph as the description", async () => {
    const { title: _, ...untitled } = schema
    const page = await renderFixture("account.json", untitled)
    expect(page.searchTokens.title).toBe("account")
    expect(page.description).toBe("An account.")
  })

  test("search tokens carry property paths and definition names; anchors carry field ids", async () => {
    const page = await renderFixture("user.json", schema)
    expect(page.searchTokens.extras).toEqual({
      properties: ["id", "name"],
      definitions: ["Address"],
    })
    expect(page.searchTokens.headings).toEqual(["Address"])
    expect(page.anchors).toEqual(expect.arrayContaining(["prop-id", "prop-name", "def-Address"]))
  })

  test("a $ref to another schema page links to its definition section", async () => {
    const other = await write(
      "address.json",
      JSON.stringify({ $schema: DIALECT, $defs: { Street: {} } }),
    )
    const target: Route = { source: other, path: "/address", kind: "jsonschema" }
    const index: RouteIndex = {
      bySource: new Map([[other, target]]),
      byPath: new Map([["/address", target]]),
    }
    const page = await renderFixture(
      "user.json",
      { $schema: DIALECT, properties: { street: { $ref: "./address.json#/$defs/Street" } } },
      index,
    )
    expect(page.html).toContain(
      '<a href="/address#def-Street"><code class="aid-schema-type">Street</code></a>',
    )
  })

  test("description links with unsafe schemes become #", async () => {
    const page = await renderFixture("user.json", {
      $schema: DIALECT,
      description: "[x](javascript:alert(1)) [y](https://example.com) ![i](data:text/html,hi)",
    })
    expect(page.html).not.toContain("javascript:")
    expect(page.html).not.toContain("data:text")
    expect(page.html).toContain('href="https://example.com"')
  })

  test("reference-style links with unsafe schemes become # too", async () => {
    const page = await renderFixture("user.json", {
      $schema: DIALECT,
      description: "[x][r]\n\n[r]: javascript:alert(1)",
    })
    expect(page.html).not.toContain("javascript:")
  })

  test("array items that are only nullable or flagged still get their own block", async () => {
    const page = await renderFixture("user.json", {
      $schema: DIALECT,
      properties: { tags: { type: "array", items: { type: ["string", "null"] } } },
    })
    expect(page.html).toContain('id="prop-tags.items"')
    expect(page.html).toContain("aid-schema-chip-nullable")
  })

  test("a primitive root shows its format and flag chips", async () => {
    const page = await renderFixture("user.json", {
      $schema: DIALECT,
      type: "string",
      format: "email",
      readOnly: true,
    })
    expect(page.html).toContain('<span class="aid-schema-chip aid-schema-chip-format">email</span>')
    expect(page.html).toContain("aid-schema-chip-readonly")
  })

  test("field and definition titles are shown", async () => {
    const page = await renderFixture("user.json", {
      $schema: DIALECT,
      properties: { a: { title: "Display Name", type: "string" } },
      $defs: { D: { title: "Dee", type: "string" } },
    })
    expect(page.html).toContain('<p class="aid-schema-title">Display Name</p>')
    expect(page.html).toContain('<p class="aid-schema-title">Dee</p>')
  })

  test("throws with the path on invalid YAML", async () => {
    const sourcePath = await write("bad.yaml", `$schema: "${DIALECT}"\ntype: [\n`)
    const route: Route = { source: sourcePath, path: "/bad", kind: "jsonschema" }
    await expect(renderJsonSchema({ route, sourcePath })).rejects.toThrow(/bad\.yaml/)
  })

  test("throws with the path on invalid JSON", async () => {
    const sourcePath = await write("bad.json", "{")
    const route: Route = { source: sourcePath, path: "/bad", kind: "jsonschema" }
    await expect(renderJsonSchema({ route, sourcePath })).rejects.toThrow(/bad\.json/)
  })
})
