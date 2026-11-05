import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import type { Route } from "../../../src/core/types"
import { renderMarkdown } from "../../../src/renderers/markdown"

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "aid-md-renderer-"))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

async function renderFixture(name: string, source: string) {
  const sourcePath = path.join(dir, name)
  await Bun.write(sourcePath, source)
  const route: Route = { source: sourcePath, path: "/page", kind: "markdown" }
  return renderMarkdown({ route, sourcePath })
}

describe("renderMarkdown", () => {
  test("frontmatter + body H1: one H1, frontmatter wins for title", async () => {
    const page = await renderFixture(
      "page.md",
      `---\ntitle: Frontmatter Title\n---\n\n# Body Heading\n\nProse.\n`,
    )
    const h1Count = (page.html.match(/<h1\b/g) ?? []).length
    expect(h1Count).toBe(1)
    expect(page.html).toContain("Body Heading")
    expect(page.searchTokens.title).toBe("Frontmatter Title")
    expect(page.route.frontmatter?.title).toBe("Frontmatter Title")
  })

  test("frontmatter only, no body H1: renderer prepends H1 with frontmatter title", async () => {
    const page = await renderFixture(
      "page.md",
      `---\ntitle: From Frontmatter\n---\n\nJust prose.\n`,
    )
    const h1Count = (page.html.match(/<h1\b/g) ?? []).length
    expect(h1Count).toBe(1)
    expect(page.html).toContain("From Frontmatter")
    expect(page.searchTokens.title).toBe("From Frontmatter")
  })

  test("no frontmatter, no body H1: filename basename becomes the H1", async () => {
    const page = await renderFixture("getting-started.md", `Some content with no heading.\n`)
    const h1Count = (page.html.match(/<h1\b/g) ?? []).length
    expect(h1Count).toBe(1)
    expect(page.html).toContain("getting-started")
    expect(page.searchTokens.title).toBe("getting-started")
  })

  test("a leading raw <h1> with no text falls back to the filename title", async () => {
    const page = await renderFixture("empty-heading.md", `<h1>\n\nTitle\n\n</h1>\n\nProse.\n`)
    expect(page.searchTokens.title).toBe("empty-heading")
  })

  test("a leading raw <h1> holding only an image falls back to the filename title", async () => {
    const page = await renderFixture(
      "hero.md",
      `<h1 align="center">\n  <img src="https://example.com/logo.png" alt="Logo">\n</h1>\n\nProse.\n`,
    )
    expect(page.searchTokens.title).toBe("hero")
  })

  test("a leading raw <h1> spanning lines gives a single-line title", async () => {
    const page = await renderFixture("page.md", `<h1>\n  My\n  Project\n</h1>\n\nProse.\n`)
    expect(page.searchTokens.title).toBe("My Project")
  })

  test("a leading raw <h1> keeps its non-breaking spaces", async () => {
    const page = await renderFixture("page.md", `<h1>v1.0&nbsp;beta</h1>\n\nProse.\n`)
    expect(page.searchTokens.title).toBe("v1.0\u00a0beta")
  })

  test("no frontmatter, body has H1: H1 text becomes the title", async () => {
    const page = await renderFixture("page.md", `# Body Wins\n\nProse here.\n`)
    const h1Count = (page.html.match(/<h1\b/g) ?? []).length
    expect(h1Count).toBe(1)
    expect(page.searchTokens.title).toBe("Body Wins")
  })

  test("GFM table renders as <table>", async () => {
    const page = await renderFixture("page.md", `# T\n\n| A | B |\n| - | - |\n| 1 | 2 |\n`)
    expect(page.html).toContain("<table>")
    expect(page.html).toContain("<th>A</th>")
  })

  test("headings get slugged ids and an appended # anchor", async () => {
    const page = await renderFixture("page.md", `# Hello World\n\n## Sub Section\n`)
    expect(page.html).toMatch(/<h1 id="hello-world">/)
    expect(page.html).toMatch(/<h2 id="sub-section">/)
    expect(page.html).toContain('class="aid-heading-anchor"')
    expect(page.html).toContain("#</span>")
    expect(page.html).not.toMatch(/<a[^>]*><h1/)
  })

  test("# inside a fenced code block is not collected as a heading", async () => {
    const page = await renderFixture(
      "page.md",
      "# Real Heading\n\n```bash\n# this is a shell comment\necho hi\n```\n",
    )
    expect(page.searchTokens.headings).toEqual(["Real Heading"])
  })

  test("invalid frontmatter (non-string title) throws", async () => {
    await expect(renderFixture("page.md", `---\ntitle: 42\n---\n\nBody.\n`)).rejects.toThrow()
  })

  test("frontmatter description ends up on the route", async () => {
    const page = await renderFixture(
      "page.md",
      `---\ntitle: T\ndescription: A short summary.\n---\n\n# T\n`,
    )
    expect(page.route.frontmatter?.description).toBe("A short summary.")
  })

  test("unknown frontmatter keys pass through", async () => {
    const page = await renderFixture("page.md", `---\ntitle: T\ntags: [docs, intro]\n---\n\n# T\n`)
    expect(page.route.frontmatter?.tags).toEqual(["docs", "intro"])
  })

  test("CRLF frontmatter delimiters are recognised and stripped", async () => {
    const page = await renderFixture(
      "page.md",
      `---\r\ntitle: Win Line Endings\r\n---\r\n\r\n# Body\r\n`,
    )
    expect(page.route.frontmatter?.title).toBe("Win Line Endings")
    expect(page.searchTokens.title).toBe("Win Line Endings")
    expect(page.html).toContain("Body")
    expect(page.html).not.toContain("---")
  })

  test("scalar frontmatter (non-mapping) throws", async () => {
    await expect(renderFixture("page.md", `---\njust-a-string\n---\n\n# T\n`)).rejects.toThrow()
  })

  test("shiki dual-theme highlights ts fences with --shiki-light/--shiki-dark", async () => {
    const page = await renderFixture("page.md", "# T\n\n```ts\nconst answer: number = 42\n```\n")
    expect(page.html).toContain('class="shiki')
    expect(page.html).toContain("language-ts")
    expect(page.html).toContain("color:light-dark(")
    expect(page.html).toContain("--shiki-light:")
    expect(page.html).toContain("--shiki-dark:")
  })

  test("shiki falls back gracefully for unknown languages", async () => {
    const page = await renderFixture("page.md", "# T\n\n```not-a-real-lang\nhello\n```\n")
    expect(page.html).toContain("hello")
    expect(page.html).not.toContain("undefined")
  })

  test("shiki preserves heading anchor markup downstream", async () => {
    const page = await renderFixture("page.md", "# Has Code\n\n```js\nconsole.log(1)\n```\n")
    expect(page.html).toMatch(/<h1 id="has-code">/)
    expect(page.html).toContain('class="aid-heading-anchor"')
  })

  test('mermaid fence is rewritten to <pre class="mermaid"> with raw source', async () => {
    const page = await renderFixture("page.md", "# T\n\n```mermaid\ngraph LR\n  A --> B\n```\n")
    expect(page.html).toContain('<pre class="mermaid">')
    expect(page.html).toContain("graph LR")
    expect(page.html).toMatch(/A --(&gt;|>) B/)
    expect(page.html).not.toMatch(/<pre class="mermaid">\s*<code/)
  })

  test("mermaid blocks are not picked up by shiki", async () => {
    const page = await renderFixture("page.md", "# T\n\n```mermaid\ngraph LR\n  A --> B\n```\n")
    expect(page.html).not.toContain('class="shiki')
    expect(page.html).not.toContain("--shiki-light:")
    expect(page.html).not.toContain("language-mermaid")
  })

  test("non-mermaid fences still get shiki-highlighted alongside a mermaid block", async () => {
    const page = await renderFixture(
      "page.md",
      "# T\n\n```mermaid\ngraph LR\n  A --> B\n```\n\n```ts\nconst x = 1\n```\n",
    )
    expect(page.html).toContain('<pre class="mermaid">')
    expect(page.html).toContain('class="shiki')
    expect(page.html).toContain("language-ts")
  })

  test("relative <img src> is rewritten via copyAsset in both html and .md outputs", async () => {
    const sourcePath = path.join(dir, "page.md")
    await Bun.write(sourcePath, "# T\n\n![alt](./hero.png)\n")
    await Bun.write(path.join(dir, "hero.png"), "binary")
    const route: Route = { source: sourcePath, path: "/page", kind: "markdown" }
    const calls: string[] = []
    const copyAsset = async (absSrc: string) => {
      calls.push(absSrc)
      return "/page/hero.png"
    }
    const page = await renderMarkdown({ route, sourcePath, copyAsset })
    expect(calls).toEqual([path.join(dir, "hero.png")])
    expect(page.html).toContain('src="/page/hero.png"')
    expect(page.html).not.toContain("./hero.png")
    const [md] = page.exports
    expect(md?.body).toContain("/page/hero.png")
    expect(md?.body).not.toContain("./hero.png")
  })

  test("missing relative <img src> leaves src untouched and surfaces a warning", async () => {
    const sourcePath = path.join(dir, "page.md")
    await Bun.write(sourcePath, "# T\n\n![alt](./missing.png)\n")
    const route: Route = { source: sourcePath, path: "/page", kind: "markdown" }
    const copyAsset = async (_absSrc: string) => null
    const page = await renderMarkdown({ route, sourcePath, copyAsset })
    expect(page.html).toContain('src="./missing.png"')
  })

  test("absolute and URL <img src> are not routed through copyAsset", async () => {
    const sourcePath = path.join(dir, "page.md")
    await Bun.write(
      sourcePath,
      "# T\n\n![](https://example.com/x.png)\n\n![](/already-absolute.png)\n",
    )
    const route: Route = { source: sourcePath, path: "/page", kind: "markdown" }
    const calls: string[] = []
    const copyAsset = async (absSrc: string) => {
      calls.push(absSrc)
      return "/should-not-be-called"
    }
    const page = await renderMarkdown({ route, sourcePath, copyAsset })
    expect(calls).toEqual([])
    expect(page.html).toContain("https://example.com/x.png")
    expect(page.html).toContain("/already-absolute.png")
  })

  test("copyAsset throwing propagates out of the renderer", async () => {
    const sourcePath = path.join(dir, "page.md")
    await Bun.write(sourcePath, "# T\n\n![](./escape.png)\n")
    const route: Route = { source: sourcePath, path: "/page", kind: "markdown" }
    const copyAsset = async () => {
      throw new Error("boundary violation")
    }
    await expect(renderMarkdown({ route, sourcePath, copyAsset })).rejects.toThrow(
      /boundary violation/,
    )
  })

  test("exports a .md sidechain with content type and frontmatter stripped", async () => {
    const page = await renderFixture(
      "page.md",
      `---\ntitle: Hidden\n---\n\n# Body Heading\n\nProse.\n`,
    )
    expect(page.exports).toHaveLength(1)
    const [md] = page.exports
    expect(md?.suffix).toBe(".md")
    expect(md?.body).not.toContain("---")
    expect(md?.body).not.toContain("title: Hidden")
    expect(md?.body).toMatch(/^# Body Heading/)
    expect(md?.body).toContain("Prose.")
  })

  test(".md export preserves relative URLs when copyAsset is absent", async () => {
    const page = await renderFixture("page.md", "# T\n\n![alt](./hero.png)\n")
    const [md] = page.exports
    expect(md?.body).toContain("./hero.png")
  })

  test("an empty frontmatter block is stripped, even with a thematic break later", async () => {
    const page = await renderFixture("page.md", "---\n---\n# Title\n\nA\n\n---\n\nB\n")
    expect(page.route.frontmatter).toBeUndefined()
    expect(page.searchTokens.title).toBe("Title")
    expect(page.html).toContain("<hr>")
  })

  test("a frontmatter block at the end of the file needs no trailing newline", async () => {
    const page = await renderFixture("page.md", "---\ntitle: Only\n---")
    expect(page.route.frontmatter?.title).toBe("Only")
  })

  test("a line that only starts with --- does not close the frontmatter", async () => {
    const page = await renderFixture("page.md", "---\ntitle: A\n----\n# B\n")
    expect(page.route.frontmatter).toBeUndefined()
  })

  test("anchors include heading ids and raw HTML ids, but not id= text in prose or code", async () => {
    const page = await renderFixture(
      "page.md",
      '# Title\n\nSet id=prose here.\n\n```html\n<div id="code"></div>\n```\n\n<div ID="Raw"></div>\n',
    )
    expect(page.anchors).toContain("title")
    expect(page.anchors).toContain("Raw")
    expect(page.anchors).not.toContain("prose")
    expect(page.anchors).not.toContain("code")
  })

  test("a leading raw <h1> counts as the page H1", async () => {
    const page = await renderFixture("page.md", "<h1>Raw Title</h1>\n\nProse.\n")
    expect((page.html.match(/<h1\b/g) ?? []).length).toBe(1)
    expect(page.searchTokens.title).toBe("Raw Title")
  })

  test("raw HTML before a markdown H1 does not add a second H1", async () => {
    const page = await renderFixture("page.md", '<img src="https://x.test/badge.svg">\n\n# Real\n')
    expect((page.html.match(/<h1\b/g) ?? []).length).toBe(1)
    expect(page.searchTokens.title).toBe("Real")
  })

  test("raw <script> in markdown passes through unchanged (trusted authors)", async () => {
    const page = await renderFixture("page.md", '# T\n\n<script>window.x = "<b>"</script>\n')
    expect(page.html).toContain('<script>window.x = "<b>"</script>')
  })

  test("colocated image srcs are decoded, and keep their query and fragment", async () => {
    const sourcePath = path.join(dir, "page.md")
    await Bun.write(
      sourcePath,
      "# T\n\n![a](./a%20b.png) ![v](./x.png?v=1) ![i](./icons.svg#star)\n",
    )
    const route: Route = { source: sourcePath, path: "/page", kind: "markdown" }
    const calls: string[] = []
    const copyAsset = async (absSrc: string) => {
      calls.push(absSrc)
      return `/page/${encodeURI(path.basename(absSrc))}`
    }
    const page = await renderMarkdown({ route, sourcePath, copyAsset })
    expect(calls.toSorted()).toEqual(
      [path.join(dir, "a b.png"), path.join(dir, "icons.svg"), path.join(dir, "x.png")].toSorted(),
    )
    expect(page.html).toContain('src="/page/a%20b.png"')
    expect(page.html).toContain('src="/page/x.png?v=1"')
    expect(page.html).toContain('src="/page/icons.svg#star"')
  })
})
