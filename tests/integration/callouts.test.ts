import { afterAll, beforeAll, expect, test } from "bun:test"
import { mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { build } from "../../src/core/pipeline"
import type { BuildContext } from "../../src/core/types"
import { makeSite } from "../helpers"

const SOURCE = `# Callouts

> [!NOTE]
> Plain note.

> [!tip]
> Lowercase *tip*.

> [!IMPORTANT]
> Important.

> [!WARNING]
>
> - first
> - second

> [!CAUTION]
> **Careful** with this.

> [!DANGER]
> Not a GitHub alert type.

> [!NOTE] trailing text
> Marker not alone on its line.

> A plain quote.
`

let cwd: string
let ctx: BuildContext
let html: string
let md: string
let css: string

beforeAll(async () => {
  cwd = await mkdtemp(path.join(tmpdir(), "aid-callouts-"))
  ctx = await makeSite(cwd)
  await Bun.write(path.join(ctx.contentDir, "index.md"), SOURCE)
  await build(ctx)
  html = await Bun.file(path.join(ctx.outputDir, "index.html")).text()
  md = await Bun.file(path.join(ctx.outputDir, "index.md")).text()
  const cssFile = (await readdir(ctx.outputDir)).find((e) => /^main\.[0-9a-f]{8}\.css$/.test(e))
  css = await Bun.file(path.join(ctx.outputDir, cssFile as string)).text()
})

afterAll(async () => {
  await rm(cwd, { recursive: true, force: true })
})

test("each GFM alert type renders as an aid-callout with its title", () => {
  for (const [type, title] of [
    ["note", "Note"],
    ["important", "Important"],
    ["caution", "Caution"],
  ]) {
    expect(html).toContain(
      `<div class="aid-callout aid-callout-${type}"><p class="aid-callout-title">${title}</p>`,
    )
  }
  expect(html).toContain("<p>Plain note.</p>")
  expect(html).not.toContain("[!NOTE]\n")
})

test("the alert marker is case-insensitive", () => {
  expect(html).toContain('<div class="aid-callout aid-callout-tip">')
  expect(html).toContain("<p>Lowercase <em>tip</em>.</p>")
})

test("a marker-only first paragraph followed by a list drops the empty paragraph", () => {
  expect(html).toMatch(
    /<div class="aid-callout aid-callout-warning"><p class="aid-callout-title">Warning<\/p>\s*<ul>/,
  )
})

test("unknown types and markers with trailing text stay plain blockquotes", () => {
  expect(html).toContain("[!DANGER]")
  expect(html).toContain("[!NOTE] trailing text")
  expect((html.match(/<blockquote>/g) ?? []).length).toBe(3)
})

test("the .md export keeps the alert markers unescaped", () => {
  expect(md).toContain("> [!NOTE]\n> Plain note.")
  expect(md).toContain("> [!TIP]")
  expect(md).toContain("> [!CAUTION]\n> **Careful** with this.")
  expect(md).not.toContain("\\[!NOTE]\n")
})

test("the compiled CSS carries the callout tokens and classes", () => {
  expect(css).toContain("--color-aid-warning")
  expect(css).toMatch(/\.aid-callout-caution\s*\{/)
})
