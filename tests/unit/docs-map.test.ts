import { describe, expect, test } from "bun:test"
import path from "node:path"
import { affectedPages, DOCS_MAP, HUB_PAGES } from "../../scripts/docs-affected"

const ROOT = path.resolve(import.meta.dir, "../..")

async function repoFiles(): Promise<string[]> {
  return (await Bun.$`git ls-files --cached --others --exclude-standard`.cwd(ROOT).quiet().text())
    .split("\n")
    .filter(Boolean)
}

describe("DOCS_MAP", () => {
  test("every mapped page exists", async () => {
    const pages = [...new Set(DOCS_MAP.flatMap((e) => e.pages))]
    const missing = []
    for (const page of pages) {
      if (!(await Bun.file(path.join(ROOT, page)).exists())) {
        missing.push(page)
      }
    }
    expect(missing).toEqual([])
  })

  test("every source glob matches at least one file", async () => {
    const files = await repoFiles()
    const dead = DOCS_MAP.flatMap((e) => e.sources).filter((source) => {
      const glob = new Bun.Glob(source)
      return !files.some((f) => glob.match(f))
    })
    expect(dead).toEqual([])
  })

  test("every hand-written page is mapped or a hub", async () => {
    const mapped = new Set([...DOCS_MAP.flatMap((e) => e.pages), ...HUB_PAGES])
    const pages = (await repoFiles()).filter(
      (f) =>
        f.startsWith("docs/content/") &&
        !f.startsWith("docs/content/reference/") &&
        /\.(md|html|proto)$/.test(f),
    )
    expect(pages.filter((p) => !mapped.has(p))).toEqual([])
  })
})

describe("affectedPages", () => {
  test("maps a source change to its pages and flags pages the change already touches", () => {
    const { pages, unmapped } = affectedPages([
      "src/lint/markdown.ts",
      "docs/content/linting/index.md",
    ])
    expect(pages).toContainEqual({ page: "docs/content/linting/index.md", touched: true })
    expect(pages).toContainEqual({ page: "docs/content/linting/configuring.md", touched: false })
    expect(unmapped).toEqual([])
  })

  test("reports watched files that only the catch-all entry matches", () => {
    const { unmapped } = affectedPages(["src/core/new-feature.ts", "README.md"])
    expect(unmapped).toEqual(["src/core/new-feature.ts"])
  })

  test.each([
    ".github/workflows/ci.yml",
    ".github/actions/setup/action.yml",
    "cliff.toml",
    "mise.toml",
  ])("maps %s to the CI page", (source) => {
    const { pages, unmapped } = affectedPages([source])
    expect(pages).toContainEqual({ page: "docs/content/contributing/ci.md", touched: false })
    expect(unmapped).toEqual([])
  })
})
