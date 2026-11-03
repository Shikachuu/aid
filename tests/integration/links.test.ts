import { afterEach, beforeEach, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { build } from "../../src/core/pipeline"
import type { BuildContext } from "../../src/core/types"
import { makeSite } from "../helpers"

const OPENAPI = 'openapi: 3.1.0\ninfo:\n  title: Pets\n  version: "1"\npaths: {}\n'
const PROTO = 'syntax = "proto3";\npackage demo.v1;\nmessage Ping {}\n'

let cwd: string

beforeEach(async () => {
  cwd = await mkdtemp(path.join(tmpdir(), "aid-links-"))
})

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true })
})

async function writeContent(ctx: BuildContext, files: Record<string, string>): Promise<void> {
  await Promise.all(
    Object.entries(files).map(([rel, body]) => Bun.write(path.join(ctx.contentDir, rel), body)),
  )
}

function readOut(ctx: BuildContext, ...segments: string[]): Promise<string> {
  return Bun.file(path.join(ctx.outputDir, ...segments)).text()
}

test("sibling .md link rewrites to its route URL", async () => {
  const ctx = await makeSite(cwd)
  await writeContent(ctx, {
    "index.md": "# Home\n\n[Setup](./setup.md)\n",
    "setup.md": "# Setup\n",
  })
  await build(ctx)
  expect(await readOut(ctx, "index.html")).toContain('href="/setup"')
})

test("nested page's relative link resolves against the source dir, not the output dir", async () => {
  const ctx = await makeSite(cwd)
  await writeContent(ctx, {
    "guides/a.md": "# A\n\n[B](./b.md) and [B again](./b)\n",
    "guides/b.md": "# B\n",
  })
  await build(ctx)
  const html = await readOut(ctx, "guides", "a", "index.html")
  expect(html).toContain('href="/guides/b">B</a>')
  expect(html).toContain('href="/guides/b">B again</a>')
})

test("link to a folder or its index.md rewrites to the folder route", async () => {
  const ctx = await makeSite(cwd)
  await writeContent(ctx, {
    "index.md": "# Home\n\n[Guides](./guides/index.md) [Guides dir](./guides/)\n",
    "guides/index.md": "# Guides\n\n[Home](../index.md) [Home dir](../)\n",
  })
  await build(ctx)
  const home = await readOut(ctx, "index.html")
  expect(home).toContain('href="/guides">Guides</a>')
  expect(home).toContain('href="/guides">Guides dir</a>')
  const guides = await readOut(ctx, "guides", "index.html")
  expect(guides).toContain('href="/">Home</a>')
  expect(guides).toContain('href="/">Home dir</a>')
})

test("links to .html, OpenAPI and .proto sources rewrite to their routes", async () => {
  const ctx = await makeSite(cwd)
  await writeContent(ctx, {
    "index.md": "# Home\n\n[About](./about.html) [API](./api.yaml) [Proto](./ping.proto)\n",
    "about.html": "<html><head><title>About</title></head><body><p>hi</p></body></html>",
    "api.yaml": OPENAPI,
    "ping.proto": PROTO,
  })
  await build(ctx)
  const html = await readOut(ctx, "index.html")
  expect(html).toContain('href="/about"')
  expect(html).toContain('href="/api"')
  expect(html).toContain('href="/ping"')
})

test("query and fragment survive the rewrite", async () => {
  const ctx = await makeSite(cwd)
  await writeContent(ctx, {
    "index.md": "# Home\n\n[Install](./setup.md?v=1#install)\n",
    "setup.md": "# Setup\n\n## Install\n",
  })
  await build(ctx)
  expect(await readOut(ctx, "index.html")).toContain('href="/setup?v=1#install"')
})

test("base_path prefixes rewritten links", async () => {
  const ctx = await makeSite(cwd, { base_path: "/docs" })
  await writeContent(ctx, {
    "index.md": "# Home\n\n[Setup](./setup.md)\n",
    "setup.md": "# Setup\n",
  })
  await build(ctx)
  expect(await readOut(ctx, "index.html")).toContain('href="/docs/setup"')
})

test("external, absolute, mailto and same-page fragment links are left alone", async () => {
  const ctx = await makeSite(cwd)
  await writeContent(ctx, {
    "index.md":
      "# Home\n\n## Part\n\n[a](https://example.com/x.md) [b](/raw/path) [c](mailto:a@b.c) [d](#part)\n",
  })
  await build(ctx)
  const html = await readOut(ctx, "index.html")
  expect(html).toContain('href="https://example.com/x.md"')
  expect(html).toContain('href="/raw/path"')
  expect(html).toContain('href="mailto:a@b.c"')
  expect(html).toContain('href="#part"')
})

test("reference-style definitions are rewritten", async () => {
  const ctx = await makeSite(cwd)
  await writeContent(ctx, {
    "index.md": "# Home\n\nSee [setup][s].\n\n[s]: ./setup.md\n",
    "setup.md": "# Setup\n",
  })
  await build(ctx)
  expect(await readOut(ctx, "index.html")).toContain('href="/setup"')
})

test("the .md export carries the rewritten href", async () => {
  const ctx = await makeSite(cwd)
  await writeContent(ctx, {
    "index.md": "# Home\n\n[Setup](./setup.md)\n",
    "setup.md": "# Setup\n",
  })
  await build(ctx)
  const md = await readOut(ctx, "index.md")
  expect(md).toContain("(/setup)")
  expect(md).not.toContain("./setup.md")
})

test("HTML page <a href> to a .md source is rewritten, including in its .md export", async () => {
  const ctx = await makeSite(cwd)
  await writeContent(ctx, {
    "about.html":
      '<html><head><title>About</title></head><body><a href="./setup.md">Setup</a></body></html>',
    "setup.md": "# Setup\n",
  })
  await build(ctx)
  expect(await readOut(ctx, "about", "index.html")).toContain('href="/setup"')
  expect(await readOut(ctx, "about.md")).toContain("(/setup)")
})

test("link to a non-content file copies it next to the page", async () => {
  const ctx = await makeSite(cwd)
  await writeContent(ctx, {
    "guides/a.md": "# A\n\n[Spec](./spec.pdf) [Data](./data.json)\n",
    "guides/spec.pdf": "%PDF",
    "guides/data.json": '{"not":"openapi"}',
  })
  await build(ctx)
  const html = await readOut(ctx, "guides", "a", "index.html")
  expect(html).toContain('href="/guides/a/spec.pdf"')
  expect(html).toContain('href="/guides/a/data.json"')
  expect(await readOut(ctx, "guides", "a", "spec.pdf")).toBe("%PDF")
})

test("proto pages fetch their .proto export by absolute URL under base_path", async () => {
  const ctx = await makeSite(cwd, { base_path: "/docs" })
  await writeContent(ctx, { "api/ping.proto": PROTO })
  await build(ctx)
  const html = await readOut(ctx, "api", "ping", "index.html")
  expect(html).toContain('data-proto-url="/docs/api/ping.proto"')
  expect(await Bun.file(path.join(ctx.outputDir, "api", "ping.proto")).exists()).toBe(true)
})
