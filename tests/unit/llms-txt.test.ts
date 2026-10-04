import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { AidConfigSchema } from "../../src/core/config"
import { buildLlmsTxt } from "../../src/core/llms-txt"
import type { BuildContext, RenderedPage, Route } from "../../src/core/types"

let cwd: string

beforeEach(async () => {
  cwd = await mkdtemp(path.join(tmpdir(), "aid-llms-"))
})

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true })
})

type CtxOverrides = {
  name?: string
  description?: string
  base_url?: string
  base_path?: string
  templatesDir?: string | null
}

function makeCtx(overrides: CtxOverrides = {}): BuildContext {
  const rawConfig: Record<string, unknown> = { name: overrides.name ?? "Test Site" }
  if (overrides.description !== undefined) {
    rawConfig.description = overrides.description
  }
  if (overrides.base_url !== undefined) {
    rawConfig.base_url = overrides.base_url
  }
  if (overrides.base_path !== undefined) {
    rawConfig.base_path = overrides.base_path
  }
  const config = AidConfigSchema.parse(rawConfig)
  return {
    config,
    cwd,
    contentDir: path.join(cwd, config.dir.content),
    outputDir: path.join(cwd, config.dir.output),
    templatesDir: overrides.templatesDir === undefined ? null : overrides.templatesDir,
    staticDir: path.join(cwd, config.dir.static),
  }
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

describe("buildLlmsTxt — bundled default template", () => {
  test("emits name, description, grouped TOC, and Optional section", async () => {
    const ctx = makeCtx({ description: "A test site." })
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

  test("Docs group is pinned first; other groups alphabetical", async () => {
    const ctx = makeCtx()
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
    const ctx = makeCtx()
    const out = await buildLlmsTxt(ctx, [
      makePage({ routePath: "/getting-started/intro", title: "Intro" }),
    ])
    expect(out).toContain("## Getting Started")
  })
})

describe("buildLlmsTxt — optional filter", () => {
  test("optional pages move to {{toc:optional}} and out of {{toc}}", async () => {
    const ctx = makeCtx()
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

  test("no optional pages → {{toc:optional}} expands to empty (header remains in default template)", async () => {
    const ctx = makeCtx()
    const out = await buildLlmsTxt(ctx, [makePage({ routePath: "/", title: "Home" })])
    expect(out).toContain("## Optional")
    // Nothing after the heading except trailing whitespace.
    const tail = out.split("## Optional")[1] ?? ""
    expect(tail.trim()).toBe("")
  })
})

describe("buildLlmsTxt — URL formation", () => {
  test("kind drives suffix: openapi → .json, proto → .proto, otherwise .md", async () => {
    const ctx = makeCtx()
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
    const ctx = makeCtx({ base_url: "https://docs.example.com" })
    const out = await buildLlmsTxt(ctx, [
      makePage({ routePath: "/", title: "Home" }),
      makePage({ routePath: "/api", title: "API", kind: "openapi" }),
    ])
    expect(out).toContain("(https://docs.example.com/index.md)")
    expect(out).toContain("(https://docs.example.com/api.json)")
  })

  test("non-default base_path is prepended to URLs", async () => {
    const ctx = makeCtx({ base_path: "/docs" })
    const out = await buildLlmsTxt(ctx, [
      makePage({ routePath: "/", title: "Home" }),
      makePage({ routePath: "/api", title: "API", kind: "openapi" }),
    ])
    expect(out).toContain("(/docs/index.md)")
    expect(out).toContain("(/docs/api.json)")
  })

  test("base_url + base_path compose into one absolute URL", async () => {
    const ctx = makeCtx({ base_url: "https://docs.example.com", base_path: "/docs" })
    const out = await buildLlmsTxt(ctx, [makePage({ routePath: "/api", title: "API" })])
    expect(out).toContain("(https://docs.example.com/docs/api.md)")
  })
})

describe("buildLlmsTxt — template override", () => {
  test("user template at <templatesDir>/llms.txt takes precedence over the bundled default", async () => {
    const templatesDir = path.join(cwd, "templates")
    await Bun.write(path.join(templatesDir, "llms.txt"), "# Custom {{name}}\n")
    const ctx = makeCtx({ templatesDir })
    const out = await buildLlmsTxt(ctx, [makePage({ routePath: "/", title: "Home" })])
    expect(out).toBe("# Custom Test Site\n")
    expect(out).not.toContain("## Docs")
  })

  test("falls back to bundled default when templates dir has no llms.txt", async () => {
    const templatesDir = path.join(cwd, "templates")
    await Bun.write(path.join(templatesDir, "other.txt"), "unrelated")
    const ctx = makeCtx({ templatesDir })
    const out = await buildLlmsTxt(ctx, [makePage({ routePath: "/", title: "Home" })])
    expect(out).toMatch(/^# Test Site/m)
    expect(out).toContain("## Docs")
  })

  test("supports {{base_url}} placeholder", async () => {
    const templatesDir = path.join(cwd, "templates")
    await Bun.write(path.join(templatesDir, "llms.txt"), "site: {{base_url}}\n")
    const ctx = makeCtx({ templatesDir, base_url: "https://docs.example.com" })
    const out = await buildLlmsTxt(ctx, [])
    expect(out).toBe("site: https://docs.example.com\n")
  })

  test("unknown placeholder throws with the placeholder name", async () => {
    const templatesDir = path.join(cwd, "templates")
    await Bun.write(path.join(templatesDir, "llms.txt"), "{{nope}}")
    const ctx = makeCtx({ templatesDir })
    await expect(buildLlmsTxt(ctx, [])).rejects.toThrow(/\{\{nope\}\}/)
  })
})
