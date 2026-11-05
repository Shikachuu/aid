import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { buildRoutes, routePathFromStem, routeUrl } from "../../src/core/router"
import type { BuildContext } from "../../src/core/types"
import { makeCtx } from "../helpers"

let cwd: string

beforeEach(async () => {
  cwd = await mkdtemp(path.join(tmpdir(), "aid-router-"))
})

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true })
})

async function writeMd(ctx: BuildContext, relative: string, body = "# T\n"): Promise<void> {
  await Bun.write(path.join(ctx.contentDir, relative), body)
}

describe("buildRoutes", () => {
  test("follows symlinked files and folders that stay inside the content dir", async () => {
    const ctx = makeCtx(cwd)
    await writeMd(ctx, "shared/intro.md")
    await symlink(
      path.join(ctx.contentDir, "shared/intro.md"),
      path.join(ctx.contentDir, "intro.md"),
    )
    await symlink(path.join(ctx.contentDir, "shared"), path.join(ctx.contentDir, "alias"))
    const routes = await buildRoutes(ctx)
    expect(routes.map((r) => r.path)).toEqual(["/alias/intro", "/intro", "/shared/intro"])
  })

  test.each([
    ["the content root", "."],
    ["an ancestor folder", "guides"],
  ])(
    "rejects a folder symlink back to %s instead of listing its pages twice",
    async (_, target) => {
      const ctx = makeCtx(cwd)
      await writeMd(ctx, "guides/deep/page.md")
      await symlink(path.join(ctx.contentDir, target), path.join(ctx.contentDir, "guides/deep/up"))
      await expect(buildRoutes(ctx)).rejects.toThrow(
        /^aid: ".*guides\/deep\/up" is a symlink to .*, which contains it, so dir\.content would list its files twice/,
      )
    },
  )

  test.each(["c#.md", "faq?.md", "100%.md", "c#/index.md"])(
    "rejects %p, whose route would need URL escaping",
    async (file) => {
      const ctx = makeCtx(cwd)
      await writeMd(ctx, file)
      await expect(buildRoutes(ctx)).rejects.toThrow(/cannot appear in a URL path unescaped/)
    },
  )

  test("rejects a symlink whose target is outside the content dir", async () => {
    const ctx = makeCtx(cwd)
    await Bun.write(path.join(cwd, "README.md"), "# Readme\n")
    await mkdir(ctx.contentDir, { recursive: true })
    await symlink(path.join(cwd, "README.md"), path.join(ctx.contentDir, "index.md"))
    await expect(buildRoutes(ctx)).rejects.toThrow(
      /^aid: ".*index\.md" resolves through a symlink to .*README\.md, outside dir\.content/,
    )
  })

  test("names dir.content when it does not exist", async () => {
    const ctx = makeCtx(cwd)
    await expect(buildRoutes(ctx)).rejects.toThrow(/^aid: dir\.content .* does not exist\.$/)
  })

  test("emits a route per .md file, sorted by path", async () => {
    const ctx = makeCtx(cwd)
    await writeMd(ctx, "index.md")
    await writeMd(ctx, "a.md")
    await writeMd(ctx, "b/index.md")
    const routes = await buildRoutes(ctx)
    expect(routes.map((r) => r.path)).toEqual(["/", "/a", "/b"])
    for (const r of routes) {
      expect(r.kind).toBe("markdown")
    }
  })

  test("excludes any path with a _-prefixed segment", async () => {
    const ctx = makeCtx(cwd)
    await writeMd(ctx, "index.md")
    await writeMd(ctx, "_drafts/wip.md")
    await writeMd(ctx, "products/_partial.md")
    await writeMd(ctx, "products/index.md")
    const routes = await buildRoutes(ctx)
    expect(routes.map((r) => r.path).sort()).toEqual(["/", "/products"])
  })

  test("throws on collision between foo.md and foo/index.md", async () => {
    const ctx = makeCtx(cwd)
    await writeMd(ctx, "products.md")
    await writeMd(ctx, "products/index.md")
    await expect(buildRoutes(ctx)).rejects.toThrow(/route collision.*\/products/)
  })

  test("emits an openapi route for a yaml file with a top-level openapi key", async () => {
    const ctx = makeCtx(cwd)
    await Bun.write(
      path.join(ctx.contentDir, "api.yaml"),
      `openapi: "3.1.0"\ninfo:\n  title: T\n  version: "1"\npaths: {}\n`,
    )
    const routes = await buildRoutes(ctx)
    expect(routes.map((r) => ({ path: r.path, kind: r.kind }))).toEqual([
      { path: "/api", kind: "openapi" },
    ])
  })

  test("silently skips yaml and json files that aren't OpenAPI specs", async () => {
    const ctx = makeCtx(cwd)
    await writeMd(ctx, "index.md")
    await Bun.write(path.join(ctx.contentDir, "data.yaml"), `name: foo\nversion: 1\n`)
    await Bun.write(path.join(ctx.contentDir, "config.json"), `{"products": [{"id": 1}]}`)
    const routes = await buildRoutes(ctx)
    expect(routes.map((r) => r.path)).toEqual(["/"])
  })

  test("emits a jsonschema route for json and yaml files with a json-schema.org $schema", async () => {
    const ctx = makeCtx(cwd)
    await Bun.write(
      path.join(ctx.contentDir, "user.json"),
      `{"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object"}`,
    )
    await Bun.write(
      path.join(ctx.contentDir, "order.yaml"),
      `$schema: "http://json-schema.org/draft-07/schema#"\ntype: object\n`,
    )
    await Bun.write(
      path.join(ctx.contentDir, "biome.json"),
      `{"$schema": "https://biomejs.dev/schemas/2.4.15/schema.json"}`,
    )
    const routes = await buildRoutes(ctx)
    expect(routes.map((r) => ({ path: r.path, kind: r.kind }))).toEqual([
      { path: "/order", kind: "jsonschema" },
      { path: "/user", kind: "jsonschema" },
    ])
  })

  test("json data that only nests a json-schema.org $schema is skipped", async () => {
    const ctx = makeCtx(cwd)
    await Bun.write(
      path.join(ctx.contentDir, "data.json"),
      JSON.stringify({ items: [{ $schema: "https://json-schema.org/draft/2020-12/schema" }] }),
    )
    expect(await buildRoutes(ctx)).toEqual([])
  })

  test("a schema next to a markdown page with the same stem fails with a hint about _", async () => {
    const ctx = makeCtx(cwd)
    await writeMd(ctx, "user.md")
    await Bun.write(
      path.join(ctx.contentDir, "user.json"),
      `{"$schema": "https://json-schema.org/draft/2020-12/schema"}`,
    )
    await expect(buildRoutes(ctx)).rejects.toThrow(/route collision.*\/user.*prefix a file/)
  })

  test("an OpenAPI spec with nested $schema keys stays an openapi route", async () => {
    const ctx = makeCtx(cwd)
    await Bun.write(
      path.join(ctx.contentDir, "api.json"),
      JSON.stringify({
        openapi: "3.1.0",
        components: {
          schemas: { A: { $schema: "https://json-schema.org/draft/2020-12/schema" } },
        },
      }),
    )
    const routes = await buildRoutes(ctx)
    expect(routes.map((r) => r.kind)).toEqual(["openapi"])
  })

  test("throws on collision between api.md and api.yaml", async () => {
    const ctx = makeCtx(cwd)
    await writeMd(ctx, "api.md")
    await Bun.write(
      path.join(ctx.contentDir, "api.yaml"),
      `openapi: "3.1.0"\ninfo:\n  title: T\n  version: "1"\npaths: {}\n`,
    )
    await expect(buildRoutes(ctx)).rejects.toThrow(/route collision.*\/api/)
  })
})

describe("routePathFromStem", () => {
  test("maps index stems and trailing slashes to their folder route", () => {
    expect(routePathFromStem("")).toBe("/")
    expect(routePathFromStem("index")).toBe("/")
    expect(routePathFromStem("guides/index")).toBe("/guides")
    expect(routePathFromStem("guides/")).toBe("/guides")
    expect(routePathFromStem("guides/setup")).toBe("/guides/setup")
  })
})

describe("routeUrl", () => {
  test("prefixes base_path and maps the root route to base_path itself", () => {
    expect(routeUrl("/", "/")).toBe("/")
    expect(routeUrl("/a/b", "/")).toBe("/a/b")
    expect(routeUrl("/", "/docs")).toBe("/docs")
    expect(routeUrl("/a", "/docs")).toBe("/docs/a")
  })
})
