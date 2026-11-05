import { afterEach, beforeEach, expect, spyOn, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { build } from "../../src/core/pipeline"
import type { BuildContext } from "../../src/core/types"
import { makeSite } from "../helpers"

const OPENAPI = 'openapi: 3.1.0\ninfo:\n  title: Pets\n  version: "1"\npaths: {}\n'

let cwd: string

beforeEach(async () => {
  cwd = await mkdtemp(path.join(tmpdir(), "aid-broken-links-"))
})

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true })
})

async function writeContent(ctx: BuildContext, files: Record<string, string>): Promise<void> {
  await Promise.all(
    Object.entries(files).map(([rel, body]) => Bun.write(path.join(ctx.contentDir, rel), body)),
  )
}

async function buildError(ctx: BuildContext): Promise<string> {
  try {
    await build(ctx)
  } catch (err) {
    return (err as Error).message
  }
  throw new Error("expected the build to fail")
}

test("link to a missing page fails the build with file:line", async () => {
  const ctx = await makeSite(cwd)
  await writeContent(ctx, { "index.md": "# Home\n\n[Gone](./gone.md)\n" })
  const message = await buildError(ctx)
  expect(message).toContain("aid: 1 broken reference")
  expect(message).toContain("docs/index.md:3:1  link/missing")
})

test("line numbers account for frontmatter", async () => {
  const ctx = await makeSite(cwd)
  await writeContent(ctx, { "index.md": "---\ntitle: Home\n---\n\nText.\n\n[Gone](./gone.md)\n" })
  expect(await buildError(ctx)).toContain("docs/index.md:7:1  link/missing")
})

test("link to a missing heading fails; existing headings and same-page ids pass", async () => {
  const ctx = await makeSite(cwd)
  await writeContent(ctx, {
    "index.md":
      "# Home\n\n## Here\n\n[ok](#here) [ok2](./setup.md#install) [bad](./setup.md#nope)\n",
    "setup.md": "# Setup\n\n## Install\n",
  })
  const message = await buildError(ctx)
  expect(message).toContain("aid: 1 broken reference")
  expect(message).toContain("link/anchor")
  expect(message).toContain("./setup.md#nope")
})

test("a raw HTML id inside markdown satisfies an anchor link", async () => {
  const ctx = await makeSite(cwd)
  await writeContent(ctx, { "index.md": '# Home\n\n<a id="custom"></a>\n\n[jump](#custom)\n' })
  await build(ctx)
})

test("fragment links into OpenAPI pages are not checked", async () => {
  const ctx = await makeSite(cwd)
  await writeContent(ctx, {
    "index.md": "# Home\n\n[op](./api.yaml#tag/pets)\n",
    "api.yaml": OPENAPI,
  })
  await build(ctx)
})

test("fragment links into JSON Schema pages are checked against field ids", async () => {
  const ctx = await makeSite(cwd)
  await writeContent(ctx, {
    "index.md": "# Home\n\n[ok](./user.json#prop-name) [bad](./user.json#prop-nope)\n",
    "user.json": JSON.stringify({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      properties: { name: { type: "string" } },
    }),
  })
  const message = await buildError(ctx)
  expect(message).toContain("aid: 1 broken reference")
  expect(message).toContain("./user.json#prop-nope")
})

test("relative links in JSON Schema descriptions rewrite, and broken ones fail the build", async () => {
  const ctx = await makeSite(cwd)
  await writeContent(ctx, {
    "setup.md": "# Setup\n",
    "user.json": JSON.stringify({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      description: "See [setup](./setup.md) and [gone](./gone.md).",
    }),
  })
  const message = await buildError(ctx)
  expect(message).toContain("aid: 1 broken reference")
  expect(message).toContain("docs/user.json:1:1  link/missing")
})

test("a missing colocated image fails the build in markdown and HTML pages", async () => {
  const ctx = await makeSite(cwd)
  await writeContent(ctx, {
    "index.md": "# Home\n\n![x](./nope.png)\n",
    "about.html": '<html><head><title>A</title></head><body><img src="./nope.png"></body></html>',
  })
  const message = await buildError(ctx)
  expect(message).toContain("aid: 2 broken references")
  expect(message).toContain("docs/about.html:1:")
  expect(message).toContain("docs/index.md:3:1  image/missing")
})

test("link to an _-prefixed source fails with the exclusion reason", async () => {
  const ctx = await makeSite(cwd)
  await writeContent(ctx, { "index.md": "# Home\n\n[draft](./_draft.md)\n", "_draft.md": "# D\n" })
  expect(await buildError(ctx)).toContain("link/excluded")
})

test("link escaping the content dir fails", async () => {
  const ctx = await makeSite(cwd)
  await Bun.write(path.join(cwd, "README.md"), "# Readme\n")
  await writeContent(ctx, { "index.md": "# Home\n\n[readme](../README.md)\n" })
  expect(await buildError(ctx)).toContain("link/outside")
})

test("problems across pages are reported in one error, sorted by file and line", async () => {
  const ctx = await makeSite(cwd)
  await writeContent(ctx, {
    "b.md": "# B\n\n[x](./x.md)\n\n[y](./y.md)\n",
    "a.md": "# A\n\n[z](./z.md)\n",
  })
  const message = await buildError(ctx)
  expect(message).toContain("aid: 3 broken references")
  const a = message.indexOf("docs/a.md:3")
  const b3 = message.indexOf("docs/b.md:3")
  const b5 = message.indexOf("docs/b.md:5")
  expect(a).toBeGreaterThan(-1)
  expect(a).toBeLessThan(b3)
  expect(b3).toBeLessThan(b5)
})

test("on_broken_links: warn finishes the build and prints the report", async () => {
  const ctx = await makeSite(cwd, { on_broken_links: "warn" })
  await writeContent(ctx, { "index.md": "# Home\n\n[Gone](./gone.md)\n" })
  const warn = spyOn(console, "warn").mockImplementation(() => {})
  try {
    await build(ctx)
    expect(warn.mock.calls.some(([msg]) => String(msg).includes("link/missing"))).toBe(true)
  } finally {
    warn.mockRestore()
  }
  expect(await Bun.file(path.join(ctx.outputDir, "index.html")).exists()).toBe(true)
})

test("invalid frontmatter fails the build naming the file", async () => {
  const ctx = await makeSite(cwd)
  await writeContent(ctx, { "guide.md": "---\ntitle: 3\n---\n# G\n" })
  expect(await buildError(ctx)).toMatch(/invalid frontmatter in .*docs\/guide\.md/)
})

test("an unresolved $ref warns without failing the build", async () => {
  const ctx = await makeSite(cwd)
  await writeContent(ctx, {
    "index.md": "# Home\n",
    "api.yaml": `${OPENAPI}components:\n  schemas:\n    A:\n      $ref: "#/components/schemas/Missing"\n`,
  })
  const warn = spyOn(console, "warn").mockImplementation(() => {})
  try {
    await build(ctx)
    const [message] = warn.mock.calls.find(([msg]) => String(msg).startsWith("aid:")) ?? []
    expect(String(message)).toStartWith("aid: 1 broken reference (1 warning)\n")
    expect(String(message)).toContain("docs/api.yaml  openapi/ref")
  } finally {
    warn.mockRestore()
  }
  expect(await Bun.file(path.join(ctx.outputDir, "index.html")).exists()).toBe(true)
})

test("a failed build writes nothing, not even the static and colocated copies", async () => {
  const ctx = await makeSite(cwd)
  await Bun.write(path.join(ctx.staticDir, "robots.txt"), "User-agent: *\n")
  await writeContent(ctx, {
    "index.md": "# Home\n\n![logo](./logo.svg)\n\n[Gone](./gone.md)\n",
    "logo.svg": "<svg/>",
  })
  expect(await buildError(ctx)).toContain("aid: 1 broken reference")
  expect(await Bun.file(path.join(ctx.outputDir, "robots.txt")).exists()).toBe(false)
  expect(await Bun.file(path.join(ctx.outputDir, "logo.svg")).exists()).toBe(false)
})
