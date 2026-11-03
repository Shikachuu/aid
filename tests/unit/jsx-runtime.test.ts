import { describe, expect, test } from "bun:test"
import { Fragment, jsx, RawHtml, render, renderDocument } from "../../src/jsx-runtime"

const Greeting = ({ name }: { name: string }) => jsx("p", { children: `Hi ${name}` })

describe("jsx-runtime", () => {
  test("renders intrinsic elements with attributes", () => {
    const el = jsx("div", { id: "x", className: "a b", children: "hi" })
    expect(render(el)).toBe('<div id="x" class="a b">hi</div>')
  })

  test("escapes string children", () => {
    const el = jsx("p", { children: "<script>alert(1)</script>" })
    expect(render(el)).toBe("<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>")
  })

  test("escapes attribute values", () => {
    const el = jsx("a", { href: 'x"&y', children: "go" })
    expect(render(el)).toBe('<a href="x&quot;&amp;y">go</a>')
  })

  test("renders boolean attributes as bare names", () => {
    const el = jsx("input", { type: "checkbox", checked: true, disabled: false })
    expect(render(el)).toBe('<input type="checkbox" checked>')
  })

  test("emits void elements without a closing tag", () => {
    expect(render(jsx("br", {}))).toBe("<br>")
    expect(render(jsx("img", { src: "x.png", alt: "" }))).toBe('<img src="x.png" alt="">')
  })

  test("Fragment passes children through unchanged", () => {
    const el = jsx(Fragment, { children: [jsx("span", { children: "a" }), "b"] })
    expect(render(el)).toBe("<span>a</span>b")
  })

  test("RawHtml injects unescaped HTML", () => {
    const el = jsx("div", {
      children: jsx(RawHtml, { html: "<em>raw</em>" }),
    })
    expect(render(el)).toBe("<div><em>raw</em></div>")
  })

  test("function components are evaluated", () => {
    expect(render(jsx(Greeting, { name: "World" }))).toBe("<p>Hi World</p>")
  })

  test("renderDocument prepends doctype", () => {
    const html = renderDocument(jsx("html", { children: jsx("body", {}) }))
    expect(html).toBe("<!doctype html><html><body></body></html>")
  })

  test("htmlFor / className are rewritten", () => {
    expect(render(jsx("label", { htmlFor: "x", children: "L" }))).toBe('<label for="x">L</label>')
  })

  test("dangerouslySetInnerHTML bypasses escaping", () => {
    const el = jsx("div", { dangerouslySetInnerHTML: { __html: "<i>x</i>" } })
    expect(render(el)).toBe("<div><i>x</i></div>")
  })
})
