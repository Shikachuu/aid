import { afterEach, beforeEach, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { build } from "../../src/core/pipeline"
import type { BuildContext } from "../../src/core/types"
import { makeSite } from "../helpers"

const OPENAPI = 'openapi: 3.1.0\ninfo:\n  title: Pets API\n  version: "1"\npaths: {}\n'
const PROTO = 'syntax = "proto3";\npackage demo.events.v1;\nmessage Ping {}\n'

let cwd: string

beforeEach(async () => {
  cwd = await mkdtemp(path.join(tmpdir(), "aid-nav-"))
})

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true })
})

async function writeContent(ctx: BuildContext, files: Record<string, string>): Promise<void> {
  await Promise.all(
    Object.entries(files).map(([rel, body]) => Bun.write(path.join(ctx.contentDir, rel), body)),
  )
}

async function sidebar(ctx: BuildContext, ...segments: string[]): Promise<string> {
  const html = await Bun.file(path.join(ctx.outputDir, ...segments, "index.html")).text()
  const match = html.match(/<nav class="aid-nav"[\s\S]*?<\/nav>/)
  expect(match).not.toBeNull()
  return (match as RegExpMatchArray)[0]
}

function linkOrder(nav: string): string[] {
  return [...nav.matchAll(/class="aid-nav-(?:link|label)"[^>]*>([^<]+)</g)].map(
    (m) => m[1] as string,
  )
}

test("folders become groups whose index page is the group link", async () => {
  const ctx = await makeSite(cwd)
  await writeContent(ctx, {
    "index.md": "# Home\n",
    "guides/index.md": "# Guides\n",
    "guides/setup.md": "# Setup\n",
  })
  await build(ctx)
  const nav = await sidebar(ctx)
  expect(nav).toContain(
    '<li class="aid-nav-item aid-nav-group"><a class="aid-nav-link" href="/guides">Guides</a>',
  )
  expect(nav).toContain('href="/guides/setup">Setup</a>')
  expect(linkOrder(nav)).toEqual(["Home", "Guides", "Setup"])
})

test("a same-named sibling page becomes its folder's link", async () => {
  const ctx = await makeSite(cwd)
  await writeContent(ctx, { "guides.md": "# Guides\n", "guides/setup.md": "# Setup\n" })
  await build(ctx)
  expect(await sidebar(ctx, "guides")).toContain(
    '<li class="aid-nav-item aid-nav-group"><a class="aid-nav-link" href="/guides" aria-current="page">Guides</a>',
  )
})

test("a folder with only an index page renders as a leaf", async () => {
  const ctx = await makeSite(cwd)
  await writeContent(ctx, { "index.md": "# Home\n", "faq/index.md": "# FAQ\n" })
  await build(ctx)
  const nav = await sidebar(ctx)
  expect(nav).toContain('<li class="aid-nav-item"><a class="aid-nav-link" href="/faq">FAQ</a></li>')
})

test("a folder without a landing page renders a title-cased label", async () => {
  const ctx = await makeSite(cwd)
  await writeContent(ctx, { "index.md": "# Home\n", "getting-started/install.md": "# Install\n" })
  await build(ctx)
  expect(await sidebar(ctx)).toContain('<span class="aid-nav-label">Getting Started</span>')
})

test("the root page sorts first and the current page carries aria-current", async () => {
  const ctx = await makeSite(cwd)
  await writeContent(ctx, { "index.md": "# Home\n", "a.md": "# A\n", "b.md": "# B\n" })
  await build(ctx)
  const nav = await sidebar(ctx, "b")
  expect(linkOrder(nav)).toEqual(["Home", "A", "B"])
  expect(nav).toContain('href="/b" aria-current="page"')
  expect(nav.match(/aria-current/g)?.length).toBe(1)
})

test("frontmatter sidebar.order and sidebar.label reorder and relabel", async () => {
  const ctx = await makeSite(cwd)
  await writeContent(ctx, {
    "index.md": "# Home\n",
    "a.md": "---\nsidebar:\n  order: 2\n---\n# A\n",
    "b.md": "---\nsidebar:\n  order: 1\n  label: Bee\n---\n# B\n",
    "c.md": "# C\n",
  })
  await build(ctx)
  expect(linkOrder(await sidebar(ctx))).toEqual(["Bee", "A", "Home", "C"])
})

test("_meta.yaml orders and labels OpenAPI, proto and index-less folders", async () => {
  const ctx = await makeSite(cwd)
  await writeContent(ctx, {
    "index.md": "# Home\n",
    "api.yaml": OPENAPI,
    "events.proto": PROTO,
    "ref/one.md": "# One\n",
    "_meta.yaml":
      "index: { order: 0 }\nevents: { label: Events, order: 1 }\napi: { order: 2 }\nref: { label: Reference }\n",
  })
  await build(ctx)
  expect(linkOrder(await sidebar(ctx))).toEqual(["Home", "Events", "Pets API", "Reference", "One"])
})

test("a _meta.yaml entry wins over page frontmatter", async () => {
  const ctx = await makeSite(cwd)
  await writeContent(ctx, {
    "a.md": "---\nsidebar:\n  label: From frontmatter\n---\n# A\n",
    "_meta.yaml": "a: { label: From meta }\n",
  })
  await build(ctx)
  expect(linkOrder(await sidebar(ctx, "a"))).toEqual(["From meta"])
})

test("an unknown _meta.yaml key fails the build naming the file", async () => {
  const ctx = await makeSite(cwd)
  await writeContent(ctx, { "a.md": "# A\n", "_meta.yaml": "missing: { order: 1 }\n" })
  await expect(build(ctx)).rejects.toThrow(/docs\/_meta\.yaml {2}nav\/unknown-entry/)
})

test("an invalid _meta.yaml shape fails the build naming the file", async () => {
  const ctx = await makeSite(cwd)
  await writeContent(ctx, { "a.md": "# A\n", "_meta.yaml": "a: { colour: red }\n" })
  await expect(build(ctx)).rejects.toThrow(/invalid .*_meta\.yaml/)
})

test("an unknown key under frontmatter sidebar fails the build", async () => {
  const ctx = await makeSite(cwd)
  await writeContent(ctx, { "a.md": "---\nsidebar:\n  weight: 1\n---\n# A\n" })
  await expect(build(ctx)).rejects.toThrow()
})

test("nav hrefs carry base_path", async () => {
  const ctx = await makeSite(cwd, { base_path: "/docs" })
  await writeContent(ctx, { "index.md": "# Home\n", "a.md": "# A\n" })
  await build(ctx)
  const nav = await sidebar(ctx)
  expect(nav).toContain('href="/docs" aria-current="page"')
  expect(nav).toContain('href="/docs/a"')
})
