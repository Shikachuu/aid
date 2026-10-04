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
