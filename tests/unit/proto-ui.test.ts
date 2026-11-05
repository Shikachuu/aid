import { describe, expect, test } from "bun:test"
import { parseProto } from "@aid/proto-ui/parser"
import { renderDocMarkdown } from "../../packages/proto-ui/src/components/doc-markdown"

describe("renderDocMarkdown", () => {
  test("escapes a raw script block", () => {
    const html = renderDocMarkdown("<script>alert(1)</script>")
    expect(html).not.toContain("<script>")
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;")
  })

  test("escapes inline html with event handlers", () => {
    const html = renderDocMarkdown("see <img src=x onerror=alert(1)> here")
    expect(html).not.toContain("<img")
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;")
  })

  test("drops javascript: links, including entity-encoded ones", () => {
    const html = renderDocMarkdown("[a](javascript:alert(1)) [b](java&#115;cript:alert(1))")
    expect(html).not.toContain("script:")
    expect(html).toContain('<a href="#">a</a>')
    expect(html).toContain('<a href="#">b</a>')
  })

  test("drops javascript: image sources", () => {
    const html = renderDocMarkdown("![x](javascript:alert(1))")
    expect(html).not.toContain("script:")
    expect(html).toContain('src="#"')
  })

  test("keeps markdown formatting and safe links", () => {
    const html = renderDocMarkdown("**bold** [x](https://example.com) [y](#pkg.Msg)")
    expect(html).toContain("<strong>bold</strong>")
    expect(html).toContain('href="https://example.com"')
    expect(html).toContain('href="#pkg.Msg"')
  })
})

describe("parseProto", () => {
  test("treats every protobuf scalar, including sfixed64, as scalar", () => {
    const ast = parseProto(`syntax = "proto3";
package demo;
message M {
  sfixed64 a = 1;
  sfixed32 b = 2;
  bytes c = 3;
}
`)
    const fields = ast.messages[0]?.fields ?? []
    expect(fields.map((f) => [f.name, f.type.scalar])).toEqual([
      ["a", true],
      ["b", true],
      ["c", true],
    ])
  })
})

const fieldRules = (source: string): Record<string, string> =>
  Object.fromEntries(parseProto(source).messages[0]?.fields.map((f) => [f.name, f.rule]) ?? [])

describe("parseProto field rules", () => {
  test.each([
    [
      "proto3 plain and optional",
      'syntax = "proto3";\nmessage M { int32 a = 1; optional int32 b = 2; repeated int32 c = 3; }',
      { a: "singular", b: "optional", c: "repeated" },
    ],
    [
      "proto2 optional and required",
      'syntax = "proto2";\nmessage M { optional int32 a = 1; required int32 b = 2; }',
      { a: "optional", b: "required" },
    ],
    [
      "no syntax line, which protoc reads as proto2",
      "message M { optional int32 a = 1; }",
      { a: "optional" },
    ],
    [
      "single-quoted syntax",
      "syntax = 'proto2';\nmessage M { optional int32 a = 1; }",
      { a: "optional" },
    ],
    [
      "editions presence",
      'edition = "2023";\nmessage M { int32 a = 1 [features.field_presence = IMPLICIT]; int32 b = 2; int32 c = 3 [features.field_presence = LEGACY_REQUIRED]; }',
      { a: "singular", b: "optional", c: "required" },
    ],
    [
      "map fields",
      'syntax = "proto3";\nmessage M { map<string, int32> a = 1; }',
      { a: "singular" },
    ],
  ] as [string, string, Record<string, string>][])("%s", (_label, source, rules) => {
    expect(fieldRules(source)).toEqual(rules)
  })
})

describe("parseProto structure", () => {
  const SOURCE = `syntax = "proto3";
package demo.v1;
import "google/protobuf/timestamp.proto";

message Pet {
  google.protobuf.Timestamp born = 1;
  Owner owner = 2 [deprecated = true];
  map<string, Owner> friends = 3;
  optional string nick = 4;
  oneof contact {
    string email = 5;
    Owner guardian = 6;
  }
  message Tag { string label = 1; }
  enum Size { SIZE_UNSPECIFIED = 0; SMALL = 1 [deprecated = true]; }
}

message Owner { Pet pet = 1; }

service PetSvc {
  rpc Get(Pet) returns (Owner);
  rpc Watch(stream Pet) returns (stream Owner) { option deprecated = true; }
}
`
  const ast = parseProto(SOURCE)
  const pet = ast.messages.find((m) => m.name === "Pet")
  const field = (name: string) => pet?.fields.find((f) => f.name === name)

  test("an unresolved import leaves later local references resolved", () => {
    expect(field("born")?.type).toEqual({
      raw: "google.protobuf.Timestamp",
      fqn: null,
      scalar: false,
    })
    expect(field("owner")?.type.fqn).toBe("demo.v1.Owner")
    expect(field("friends")?.type.fqn).toBe("demo.v1.Owner")
    expect(field("guardian")?.type.fqn).toBe("demo.v1.Owner")
    expect(ast.messages.find((m) => m.name === "Owner")?.fields[0]?.type.fqn).toBe("demo.v1.Pet")
    const [get] = ast.services[0]?.rpcs ?? []
    expect([get?.requestType.fqn, get?.responseType.fqn]).toEqual(["demo.v1.Pet", "demo.v1.Owner"])
  })

  test("maps get a scalar key, and real oneofs name their members", () => {
    expect(field("friends")?.mapKey).toEqual({ raw: "string", fqn: null, scalar: true })
    expect(pet?.oneofs.map((o) => o.name)).toEqual(["contact"])
    expect(field("email")?.oneofName).toBe("contact")
    expect(field("nick")?.oneofName).toBeUndefined()
  })

  test("nested types stay on their parent with dotted fqns", () => {
    expect(ast.messages.map((m) => m.fqn)).toEqual(["demo.v1.Pet", "demo.v1.Owner"])
    expect(pet?.nestedMessages.map((m) => m.fqn)).toEqual(["demo.v1.Pet.Tag"])
    expect(pet?.nestedEnums.map((e) => e.fqn)).toEqual(["demo.v1.Pet.Size"])
  })

  test("deprecated flags and streaming are mapped", () => {
    expect(field("owner")?.deprecated).toBe(true)
    expect(pet?.nestedEnums[0]?.values.map((v) => [v.name, v.deprecated])).toEqual([
      ["SIZE_UNSPECIFIED", false],
      ["SMALL", true],
    ])
    const watch = ast.services[0]?.rpcs.find((r) => r.name === "Watch")
    expect([watch?.clientStreaming, watch?.serverStreaming, watch?.deprecated]).toEqual([
      true,
      true,
      true,
    ])
  })

  test("a file without a package has no package doc", () => {
    const bare = parseProto('syntax = "proto3";\n// doc\nmessage M {}\n')
    expect([bare.package, bare.packageLeadingComment]).toEqual([null, null])
  })
})
