import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
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
  await writeFile(sourcePath, source)
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

  test("shiki dual-theme highlights ts fences with --shiki-light/--shiki-dark", async () => {
    const page = await renderFixture("page.md", "# T\n\n```ts\nconst answer: number = 42\n```\n")
    expect(page.html).toContain('class="shiki')
    expect(page.html).toContain("language-ts")
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
})
