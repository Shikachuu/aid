import { describe, expect, test } from "bun:test"
import { parseProto } from "@aid/proto-ui/parser"
import { renderSafeDocMarkdown } from "../../packages/proto-ui/src/components/doc-markdown"
import {
  summarizeEnum,
  summarizeMessage,
} from "../../packages/proto-ui/src/components/summarize-proto"

describe("renderSafeDocMarkdown", () => {
  test("escapes a raw script block", () => {
    const html = renderSafeDocMarkdown("<script>alert(1)</script>")
    expect(html).not.toContain("<script>")
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;")
  })

  test("escapes inline html with event handlers", () => {
    const html = renderSafeDocMarkdown("see <img src=x onerror=alert(1)> here")
    expect(html).not.toContain("<img")
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;")
  })

  test("drops javascript: links, including entity-encoded ones", () => {
    const html = renderSafeDocMarkdown("[a](javascript:alert(1)) [b](java&#115;cript:alert(1))")
    expect(html).not.toContain("script:")
    expect(html).toContain('<a href="#">a</a>')
    expect(html).toContain('<a href="#">b</a>')
  })

  test("drops javascript: image sources", () => {
    const html = renderSafeDocMarkdown("![x](javascript:alert(1))")
    expect(html).not.toContain("script:")
    expect(html).toContain('src="#"')
  })

  test.each([
    "data:text/html,<b>x</b>",
    "vbscript:msgbox(1)",
    "JavaScript:alert(1)",
    " javascript:alert(1)",
  ])("drops the unsafe link %s", (href) => {
    expect(renderSafeDocMarkdown(`[a](<${href}>)`)).toContain('<a href="#">a</a>')
  })

  test("keeps relative links, including ones with a colon after the path", () => {
    const html = renderSafeDocMarkdown("[a](./x.md) [b](/p?q=a:b) [c](//cdn.example/x)")
    expect(html).toContain('href="./x.md"')
    expect(html).toContain('href="/p?q=a:b"')
    expect(html).toContain('href="//cdn.example/x"')
  })

  test("keeps markdown formatting and safe links", () => {
    const html = renderSafeDocMarkdown("**bold** [x](https://example.com) [y](#pkg.Msg)")
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
      "a syntax line inside a comment does not count",
      '/* syntax = "proto2"; */\nsyntax = "proto3";\nmessage M { int32 a = 1; }',
      { a: "singular" },
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

  test.each([
    [
      "line comments",
      "// Pet store.\n// Second line.\npackage demo;\n",
      "Pet store.\nSecond line.",
    ],
    [
      "a starred block",
      "/**\n * Pet store.\n * Second line.\n */\npackage demo;\n",
      "Pet store.\nSecond line.",
    ],
    ["a one-line block", "/* Pet store. */\npackage demo;\n", "Pet store."],
    ["a block with a literal /*", "/** Matches a/* glob. */\npackage demo;\n", "Matches a/* glob."],
    [
      "a block after a line comment that holds /*",
      "// see a/*\n/* Pet store. */\npackage demo;\n",
      "Pet store.",
    ],
    ["//! lines", "//! Pet store.\n/// Second line.\npackage demo;\n", "Pet store.\nSecond line."],
    ["nothing when a blank line detaches the comment", "// License.\n\npackage demo;\n", null],
    ["nothing when a blank line detaches a block", "/* License. */\n\npackage demo;\n", null],
    [
      "the block above the real package line, not a package line inside it",
      "/*\npackage fake;\n*/\npackage demo;\n",
      "package fake;",
    ],
    [
      "a block without stars",
      "/*\n  Pet store.\n  * a bullet\n*/\npackage demo;\n",
      "Pet store.\n* a bullet",
    ],
    ["an empty block", "/* */\npackage demo;\n", null],
  ])("the package doc comes from %s", (_label, head, doc) => {
    expect(parseProto(`syntax = "proto3";\n${head}`).packageLeadingComment).toBe(doc)
  })

  test("a file without a package has no package doc", () => {
    const bare = parseProto('syntax = "proto3";\n// doc\nmessage M {}\n')
    expect([bare.package, bare.packageLeadingComment]).toEqual([null, null])
  })
})

describe("parseProto edge cases", () => {
  test("extension fields stay off the extended message", () => {
    const ast = parseProto(`syntax = "proto2";
package p;
message M { optional int32 a = 1; extensions 100 to 200; }
extend M { optional int32 e = 100; }
`)
    expect(ast.messages[0]?.fields.map((f) => f.name)).toEqual(["a"])
  })

  test("//! comments lose their bang", () => {
    const ast = parseProto(
      'syntax = "proto3";\n//! A message.\nmessage M {\n  //! A field.\n  int32 a = 1;\n}\n',
    )
    expect(ast.messages[0]?.comment).toBe("A message.")
    expect(ast.messages[0]?.fields[0]?.comment).toBe("A field.")
  })

  test("a comment that starts with an image keeps its bang", () => {
    const ast = parseProto('syntax = "proto3";\n// ![diagram](d.png)\nmessage M {}\n')
    expect(ast.messages[0]?.comment).toBe("![diagram](d.png)")
  })

  test("nesting past the protobufjs limit names the line", () => {
    const depth = 40
    const source = `syntax = "proto3";\n${Array.from({ length: depth }, (_, i) => `message M${i} {\n`).join("")}${"}\n".repeat(depth)}`
    expect(() => parseProto(source)).toThrow(/max depth exceeded: .*\(line 34\)/)
  })
})

describe("declaration summaries", () => {
  const message = (source: string) => {
    const ast = parseProto(source)
    const m = ast.messages[0]
    if (!m) {
      throw new Error("no message")
    }
    return summarizeMessage(m, ast.syntax)
  }

  test("proto3 keeps labels only where they are valid", () => {
    expect(
      message(
        'syntax = "proto3";\nmessage M { int32 a = 1; optional int32 b = 2; repeated int32 c = 3; map<string, int32> d = 4; oneof o { string e = 5; } }',
      ),
    ).toBe(`message M {
  int32 a = 1;
  optional int32 b = 2;
  repeated int32 c = 3;
  map<string, int32> d = 4;
  oneof o {
    string e = 5;
  }
}`)
  })

  test("proto2 oneof members print without a label", () => {
    expect(
      message('syntax = "proto2";\nmessage M { required int32 a = 1; oneof o { string e = 2; } }'),
    ).toBe(`message M {
  required int32 a = 1;
  oneof o {
    string e = 2;
  }
}`)
  })

  test("editions presence prints as a feature, not a label", () => {
    expect(
      message(
        'edition = "2023";\nmessage M { int32 a = 1 [features.field_presence = IMPLICIT]; int32 b = 2; int32 c = 3 [features.field_presence = LEGACY_REQUIRED]; repeated int32 d = 4; }',
      ),
    ).toBe(`message M {
  int32 a = 1 [features.field_presence = IMPLICIT];
  int32 b = 2;
  int32 c = 3 [features.field_presence = LEGACY_REQUIRED];
  repeated int32 d = 4;
}`)
  })

  test("an enum with aliases keeps allow_alias", () => {
    const ast = parseProto(
      'syntax = "proto3";\nenum E { option allow_alias = true; A = 0; B = 0; C = 1; }',
    )
    const e = ast.enums[0]
    expect(e && summarizeEnum(e)).toBe(`enum E {
  option allow_alias = true;
  A = 0;
  B = 0;
  C = 1;
}`)
  })

  test("summaries parse again", () => {
    const sources = [
      'syntax = "proto2";\nmessage M { optional group G = 1 { optional int32 x = 2; } required int32 r = 3; oneof o { string e = 4; } }',
      'edition = "2023";\nmessage M { int32 a = 1 [features.field_presence = IMPLICIT]; int32 c = 3 [features.field_presence = LEGACY_REQUIRED]; }',
    ]
    for (const source of sources) {
      const ast = parseProto(source)
      const header = source.slice(0, source.indexOf("\n") + 1)
      const m = ast.messages[0]
      expect(m).toBeDefined()
      expect(() => parseProto(header + summarizeMessage(m as never, ast.syntax))).not.toThrow()
    }
  })
})
