import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { buildLlmsTxt as buildWithNav } from "../../src/core/llms-txt"
import { buildNav } from "../../src/core/nav"
import type { BuildContext, RenderedPage, Route } from "../../src/core/types"
import { makeCtx } from "../helpers"

let cwd: string

beforeEach(async () => {
  cwd = await mkdtemp(path.join(tmpdir(), "aid-llms-"))
})

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true })
})

async function buildLlmsTxt(ctx: BuildContext, pages: RenderedPage[]): Promise<string> {
  return buildWithNav(ctx, pages, (await buildNav(ctx, pages)).tree)
}

function makePage(args: {
  routePath: string
  kind?: Route["kind"]
  title: string
  description?: string
  optional?: boolean
}): RenderedPage {
  const kind = args.kind ?? "markdown"
  const route: Route = {
    source: `docs${args.routePath === "/" ? "/index" : args.routePath}.md`,
    path: args.routePath,
    kind,
    frontmatter: {
      title: args.title,
      ...(args.description !== undefined ? { description: args.description } : {}),
      ...(args.optional ? { llms: "optional" as const } : {}),
    },
  }
  return {
    route,
    html: "",
    searchTokens: { title: args.title, body: "", headings: [], extras: {} },
    exports: [
      {
        suffix: kind === "openapi" ? ".json" : kind === "proto" ? ".proto" : ".md",
        body: "",
      },
    ],
    hasMermaid: false,
    hasOpenApi: kind === "openapi",
    hasProto: kind === "proto",
    description: args.description,
  }
}

describe("buildLlmsTxt - bundled default template", () => {
  test("emits name, description, grouped TOC, and Optional section", async () => {
    const ctx = makeCtx(cwd, { description: "A test site." })
    const out = await buildLlmsTxt(ctx, [
      makePage({ routePath: "/", title: "Home", description: "Landing." }),
      makePage({
        routePath: "/guides/intro",
        title: "Intro",
        description: "Get started.",
      }),
      makePage({ routePath: "/guides/advanced", title: "Advanced" }),
      makePage({
        routePath: "/api",
        kind: "openapi",
        title: "Pets API",
        description: "Pet store.",
      }),
    ])

    expect(out).toMatch(/^# Test Site/m)
    expect(out).toContain("> A test site.")
    expect(out).toContain("## Docs")
    expect(out).toContain("## Guides")
    expect(out).toContain("[Home](/index.md): Landing.")
    expect(out).toContain("[Pets API](/api.json): Pet store.")
    expect(out).toContain("[Intro](/guides/intro.md): Get started.")
    expect(out).toContain("[Advanced](/guides/advanced.md)")
    expect(out).not.toContain("{{")
  })

  test("Docs group is pinned first; other groups follow sidebar order", async () => {
    const ctx = makeCtx(cwd)
    const out = await buildLlmsTxt(ctx, [
      makePage({ routePath: "/zeta/a", title: "Z" }),
      makePage({ routePath: "/alpha/a", title: "A" }),
      makePage({ routePath: "/", title: "Home" }),
    ])
    const docsIdx = out.indexOf("## Docs")
    const alphaIdx = out.indexOf("## Alpha")
    const zetaIdx = out.indexOf("## Zeta")
    expect(docsIdx).toBeGreaterThan(-1)
    expect(alphaIdx).toBeGreaterThan(-1)
    expect(zetaIdx).toBeGreaterThan(-1)
    expect(docsIdx).toBeLessThan(alphaIdx)
    expect(alphaIdx).toBeLessThan(zetaIdx)
  })

  test("title-cases multi-word directory slugs", async () => {
    const ctx = makeCtx(cwd)
    const out = await buildLlmsTxt(ctx, [
      makePage({ routePath: "/getting-started/intro", title: "Intro" }),
    ])
    expect(out).toContain("## Getting Started")
  })
})

describe("buildLlmsTxt - sections follow the sidebar", () => {
  test("a folder landing page joins its folder's section, named by its title", async () => {
    const ctx = makeCtx(cwd)
    const out = await buildLlmsTxt(ctx, [
      makePage({ routePath: "/", title: "Home" }),
      makePage({ routePath: "/guides", title: "User guides" }),
      makePage({ routePath: "/guides/intro", title: "Intro" }),
    ])
    const section = out.slice(out.indexOf("## User guides"))
    expect(section).toContain("[User guides](/guides.md)")
    expect(section).toContain("[Intro](/guides/intro.md)")
    expect(out.slice(0, out.indexOf("## User guides"))).not.toContain("[User guides]")
  })

  test("_meta.yaml order and labels reorder and rename sections", async () => {
    await Bun.write(
      path.join(cwd, "docs", "_meta.yaml"),
      "zeta: { label: Last but first, order: 1 }\nalpha: { order: 2 }\n",
    )
    const ctx = makeCtx(cwd)
    const out = await buildLlmsTxt(ctx, [
      makePage({ routePath: "/alpha/a", title: "A" }),
      makePage({ routePath: "/zeta/z", title: "Z" }),
    ])
    expect(out.indexOf("## Last but first")).toBeGreaterThan(-1)
    expect(out.indexOf("## Last but first")).toBeLessThan(out.indexOf("## Alpha"))
  })
})

describe("buildLlmsTxt - optional filter", () => {
  test("optional pages move to {{toc:optional}} and out of {{toc}}", async () => {
    const ctx = makeCtx(cwd)
    const out = await buildLlmsTxt(ctx, [
      makePage({ routePath: "/", title: "Home" }),
      makePage({ routePath: "/changelog", title: "Changelog", optional: true }),
    ])

    const optionalHeadingIdx = out.indexOf("## Optional")
    expect(optionalHeadingIdx).toBeGreaterThan(-1)
    const optionalSection = out.slice(optionalHeadingIdx)
    expect(optionalSection).toContain("[Changelog](/changelog.md)")

    const docsHeadingIdx = out.indexOf("## Docs")
    const docsSection = out.slice(docsHeadingIdx, optionalHeadingIdx)
    expect(docsSection).not.toContain("[Changelog]")
    expect(docsSection).toContain("[Home](/index.md)")
  })

  test("no optional pages -> the default template has no Optional section", async () => {
    const ctx = makeCtx(cwd)
    const out = await buildLlmsTxt(ctx, [makePage({ routePath: "/", title: "Home" })])
    expect(out).not.toContain("## Optional")
    expect(out.endsWith("- [Home](/index.md)\n")).toBe(true)
  })
})

describe("buildLlmsTxt - page lines", () => {
  test("escapes brackets in titles and parentheses and spaces in URLs", async () => {
    const ctx = makeCtx(cwd)
    const out = await buildLlmsTxt(ctx, [
      makePage({ routePath: "/a (b) c", title: "Use [x] here" }),
    ])
    expect(out).toContain("- [Use \\[x\\] here](/a%20%28b%29%20c.md)")
  })

  test("joins a multi-line description onto the bullet line", async () => {
    const ctx = makeCtx(cwd)
    const out = await buildLlmsTxt(ctx, [
      makePage({ routePath: "/", title: "Home", description: "First line\n  second line" }),
    ])
    expect(out).toContain("- [Home](/index.md): First line second line\n")
  })
})

describe("buildLlmsTxt - URL formation", () => {
  test("kind drives suffix: openapi -> .json, proto -> .proto, otherwise .md", async () => {
    const ctx = makeCtx(cwd)
    const out = await buildLlmsTxt(ctx, [
      makePage({ routePath: "/md", title: "MD", kind: "markdown" }),
      makePage({ routePath: "/html", title: "HTML", kind: "html" }),
      makePage({ routePath: "/oa", title: "OA", kind: "openapi" }),
      makePage({ routePath: "/pb", title: "PB", kind: "proto" }),
    ])
    expect(out).toContain("(/md.md)")
    expect(out).toContain("(/html.md)")
    expect(out).toContain("(/oa.json)")
    expect(out).toContain("(/pb.proto)")
  })

  test("absolute URLs when base_url is set", async () => {
    const ctx = makeCtx(cwd, { base_url: "https://docs.example.com" })
    const out = await buildLlmsTxt(ctx, [
      makePage({ routePath: "/", title: "Home" }),
      makePage({ routePath: "/api", title: "API", kind: "openapi" }),
    ])
    expect(out).toContain("(https://docs.example.com/index.md)")
    expect(out).toContain("(https://docs.example.com/api.json)")
  })

  test("non-default base_path is prepended to URLs", async () => {
    const ctx = makeCtx(cwd, { base_path: "/docs" })
    const out = await buildLlmsTxt(ctx, [
      makePage({ routePath: "/", title: "Home" }),
      makePage({ routePath: "/api", title: "API", kind: "openapi" }),
    ])
    expect(out).toContain("(/docs/index.md)")
    expect(out).toContain("(/docs/api.json)")
  })

  test("base_url + base_path compose into one absolute URL", async () => {
    const ctx = makeCtx(cwd, { base_url: "https://docs.example.com", base_path: "/docs" })
    const out = await buildLlmsTxt(ctx, [makePage({ routePath: "/api", title: "API" })])
    expect(out).toContain("(https://docs.example.com/docs/api.md)")
  })
})

describe("buildLlmsTxt - template override", () => {
  test("user template at <templatesDir>/llms.txt takes precedence over the bundled default", async () => {
    await Bun.write(path.join(cwd, "templates", "llms.txt"), "# Custom {{name}}\n")
    const ctx = makeCtx(cwd, { dir: { templates: "templates" } })
    const out = await buildLlmsTxt(ctx, [makePage({ routePath: "/", title: "Home" })])
    expect(out).toBe("# Custom Test Site\n")
    expect(out).not.toContain("## Docs")
  })

  test("falls back to bundled default when templates dir has no llms.txt", async () => {
    await Bun.write(path.join(cwd, "templates", "other.txt"), "unrelated")
    const ctx = makeCtx(cwd, { dir: { templates: "templates" } })
    const out = await buildLlmsTxt(ctx, [makePage({ routePath: "/", title: "Home" })])
    expect(out).toMatch(/^# Test Site/m)
    expect(out).toContain("## Docs")
  })

  test("supports {{base_url}} placeholder", async () => {
    await Bun.write(path.join(cwd, "templates", "llms.txt"), "site: {{base_url}}\n")
    const ctx = makeCtx(cwd, {
      dir: { templates: "templates" },
      base_url: "https://docs.example.com",
    })
    const out = await buildLlmsTxt(ctx, [])
    expect(out).toBe("site: https://docs.example.com\n")
  })

  test("unknown placeholder throws with the placeholder name", async () => {
    await Bun.write(path.join(cwd, "templates", "llms.txt"), "{{nope}}")
    const ctx = makeCtx(cwd, { dir: { templates: "templates" } })
    await expect(buildLlmsTxt(ctx, [])).rejects.toThrow(/\{\{nope\}\}/)
  })

  test.each(["constructor", "toString", "__proto__"])(
    "treats the inherited key {{%s}} as an unknown placeholder",
    async (name) => {
      await Bun.write(path.join(cwd, "templates", "llms.txt"), `{{${name}}}`)
      const ctx = makeCtx(cwd, { dir: { templates: "templates" } })
      await expect(buildLlmsTxt(ctx, [])).rejects.toThrow(/unknown llms.txt placeholder/)
    },
  )
})
