import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import type { Route } from "../../../src/core/types"
import { renderHtml } from "../../../src/renderers/html"

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "aid-html-renderer-"))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

async function renderFixture(name: string, source: string) {
  const sourcePath = path.join(dir, name)
  await Bun.write(sourcePath, source)
  const route: Route = { source: sourcePath, path: "/page", kind: "html" }
  return renderHtml({ route, sourcePath })
}

function doc(head: string, body: string): string {
  return `<!DOCTYPE html><html><head>${head}</head><body>${body}</body></html>`
}

describe("renderHtml", () => {
  test("<title> and <meta description> populate route.frontmatter and searchTokens.title", async () => {
    const page = await renderFixture(
      "page.html",
      doc(
        `<title>Hello World</title><meta name="description" content="A test page.">`,
        `<p>Hi.</p>`,
      ),
    )
    expect(page.route.frontmatter?.title).toBe("Hello World")
    expect(page.route.frontmatter?.description).toBe("A test page.")
    expect(page.searchTokens.title).toBe("Hello World")
    expect(page.description).toBe("A test page.")
  })

  test("missing <title> falls back to the filename basename", async () => {
    const page = await renderFixture("about.html", doc(``, `<p>No title.</p>`))
    expect(page.route.frontmatter?.title).toBeUndefined()
    expect(page.searchTokens.title).toBe("about")
  })

  test("empty <title></title> falls back to filename (treated as absent)", async () => {
    const page = await renderFixture("about.html", doc(`<title></title>`, `<p>x</p>`))
    expect(page.route.frontmatter?.title).toBeUndefined()
    expect(page.searchTokens.title).toBe("about")
  })

  test("rendered html is body-only — no <html>/<head>/<title>/<body> in the output", async () => {
    const page = await renderFixture(
      "page.html",
      doc(`<title>T</title>`, `<h1>Heading</h1><p>Para.</p>`),
    )
    expect(page.html).toContain("<h1>Heading</h1>")
    expect(page.html).toContain("<p>Para.</p>")
    expect(page.html).not.toContain("<html")
    expect(page.html).not.toContain("<head")
    expect(page.html).not.toContain("<body")
    expect(page.html).not.toContain("<title")
  })

  test("hasOpenApi is always false", async () => {
    const page = await renderFixture("page.html", doc(`<title>T</title>`, `<p>x</p>`))
    expect(page.hasOpenApi).toBe(false)
  })

  test("body without <pre class='mermaid'> leaves hasMermaid false", async () => {
    const page = await renderFixture(
      "page.html",
      doc(`<title>T</title>`, `<pre>not mermaid</pre><div>also not</div>`),
    )
    expect(page.hasMermaid).toBe(false)
  })

  test("<pre class='mermaid'> flips hasMermaid to true", async () => {
    const page = await renderFixture(
      "page.html",
      doc(`<title>T</title>`, `<pre class="mermaid">graph TD; A --> B</pre>`),
    )
    expect(page.hasMermaid).toBe(true)
  })

  test("<div class='mermaid'> also flips hasMermaid to true", async () => {
    const page = await renderFixture(
      "page.html",
      doc(`<title>T</title>`, `<div class="mermaid">graph LR; X --> Y</div>`),
    )
    expect(page.hasMermaid).toBe(true)
  })

  test("missing <html>/<body> rejects with a clear error mentioning the source path", async () => {
    const sourcePath = path.join(dir, "fragment.html")
    await Bun.write(sourcePath, `<p>Just a fragment.</p>`)
    const route: Route = { source: sourcePath, path: "/fragment", kind: "html" }
    await expect(renderHtml({ route, sourcePath })).rejects.toThrow(
      /fragment\.html must be a full HTML document/,
    )
  })

  test(".md sidechain is emitted with text/markdown content type", async () => {
    const page = await renderFixture(
      "page.html",
      doc(`<title>T</title>`, `<h1>Heading</h1><p>Body.</p>`),
    )
    expect(page.exports).toHaveLength(1)
    const [md] = page.exports
    expect(md?.suffix).toBe(".md")
    expect(md?.body).toContain("# Heading")
    expect(md?.body).toContain("Body.")
  })

  test("relative <img src> is rewritten via copyAsset in both html and .md outputs", async () => {
    const sourcePath = path.join(dir, "page.html")
    await Bun.write(sourcePath, doc(`<title>T</title>`, `<p><img src="./hero.png" alt="hero"></p>`))
    await Bun.write(path.join(dir, "hero.png"), "binary")
    const route: Route = { source: sourcePath, path: "/page", kind: "html" }
    const calls: string[] = []
    const copyAsset = async (absSrc: string) => {
      calls.push(absSrc)
      return "/page/hero.png"
    }
    const page = await renderHtml({ route, sourcePath, copyAsset })
    expect(calls).toEqual([path.join(dir, "hero.png")])
    expect(page.html).toContain('src="/page/hero.png"')
    expect(page.html).not.toContain("./hero.png")
    const [md] = page.exports
    expect(md?.body).toContain("/page/hero.png")
    expect(md?.body).not.toContain("./hero.png")
  })

  test("absolute and URL <img src> bypass copyAsset", async () => {
    const sourcePath = path.join(dir, "page.html")
    await Bun.write(
      sourcePath,
      doc(
        `<title>T</title>`,
        `<img src="https://example.com/x.png"><img src="/already-absolute.png">`,
      ),
    )
    const route: Route = { source: sourcePath, path: "/page", kind: "html" }
    const calls: string[] = []
    const copyAsset = async (absSrc: string) => {
      calls.push(absSrc)
      return "/should-not-be-called"
    }
    const page = await renderHtml({ route, sourcePath, copyAsset })
    expect(calls).toEqual([])
    expect(page.html).toContain("https://example.com/x.png")
    expect(page.html).toContain("/already-absolute.png")
  })

  test("<meta name=description> without content leaves description undefined", async () => {
    const page = await renderFixture(
      "page.html",
      doc(`<title>T</title><meta name="description">`, `<p>x</p>`),
    )
    expect(page.route.frontmatter?.description).toBeUndefined()
    expect(page.description).toBeUndefined()
  })

  test("tables and strikethrough survive into the .md export", async () => {
    const page = await renderFixture(
      "table.html",
      doc(
        "<title>T</title>",
        "<table><thead><tr><th>Key</th></tr></thead><tbody><tr><td>a</td></tr></tbody></table><p><del>old</del></p>",
      ),
    )
    const md = page.exports[0]?.body ?? ""
    expect(md).toContain("| Key |")
    expect(md).toContain("~~old~~")
  })

  test("elements markdown cannot express stay HTML in the .md export", async () => {
    const page = await renderFixture(
      "rich.html",
      doc(
        "<title>T</title>",
        [
          "<p>Intro.</p>",
          "<details><summary>More</summary><p>Hidden.</p></details>",
          "<dl><dt>Term</dt><dd>Meaning</dd></dl>",
          '<table><tr><th colspan="2">Wide</th></tr><tr><td>a</td><td>b</td></tr></table>',
          "<table><tr><th>K</th></tr><tr><td>line 1<br>line 2</td></tr></table>",
          "<table><tr><th>Plain</th></tr><tr><td>x</td></tr></table>",
        ].join(""),
      ),
    )
    const md = page.exports[0]?.body ?? ""
    expect(md).toContain("Intro.")
    expect(md).toContain("<details><summary>More</summary><p>Hidden.</p></details>")
    expect(md).toContain("<dl><dt>Term</dt><dd>Meaning</dd></dl>")
    expect(md).toContain('<th colspan="2">Wide</th>')
    expect(md).toContain("<td>line 1<br>line 2</td>")
    expect(md).toContain("| Plain |")
    expect(page.html).toContain("<details><summary>More</summary>")
  })

  test("search indexes visible body text and every heading, not markup or scripts", async () => {
    const page = await renderFixture(
      "page.html",
      doc(
        `<title>T</title>`,
        `<h1>Top</h1><p class="lead">Hello <b>world</b></p><h3>Deep</h3><script>var secret = 1</script><style>.x{color:red}</style>`,
      ),
    )
    expect(page.searchTokens.body).toBe("Top Hello world Deep")
    expect(page.searchTokens.headings).toEqual(["Top", "Deep"])
  })

  test("anchors come from id and name attributes, not from text that looks like one", async () => {
    const page = await renderFixture(
      "page.html",
      doc(
        ``,
        `<h2 ID="Upper">U</h2><a name="old"></a><p>set id=fake here</p><code>name="code"</code>`,
      ),
    )
    expect(page.anchors).toEqual(["Upper", "old"])
  })
})
