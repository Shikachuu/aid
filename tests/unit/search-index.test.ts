import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { AidConfigSchema } from "../../src/core/config"
import { buildSearchIndex } from "../../src/core/search-index"
import type { BuildContext, RenderedPage, Route } from "../../src/core/types"

let cwd: string

beforeEach(async () => {
  cwd = await mkdtemp(path.join(tmpdir(), "aid-search-"))
})

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true })
})

type CtxOverrides = {
  base_path?: string
  searchEnabled?: boolean
  typoTolerance?: number
  weights?: { markdown?: number; html?: number; openapi?: number; proto?: number }
}

function makeCtx(overrides: CtxOverrides = {}): BuildContext {
  const rawConfig: Record<string, unknown> = { name: "Test Site" }
  if (overrides.base_path !== undefined) {
    rawConfig.base_path = overrides.base_path
  }
  if (
    overrides.searchEnabled !== undefined ||
    overrides.typoTolerance !== undefined ||
    overrides.weights !== undefined
  ) {
    const search: Record<string, unknown> = {}
    if (overrides.searchEnabled !== undefined) {
      search.enabled = overrides.searchEnabled
    }
    if (overrides.typoTolerance !== undefined) {
      search.typo_tolerance = overrides.typoTolerance
    }
    if (overrides.weights !== undefined) {
      search.weights = overrides.weights
    }
    rawConfig.search = search
  }
  const config = AidConfigSchema.parse(rawConfig)
  return {
    config,
    cwd,
    contentDir: path.join(cwd, config.dir.content),
    outputDir: path.join(cwd, config.dir.output),
    templatesDir: null,
    staticDir: path.join(cwd, config.dir.static),
  }
}

function makePage(args: {
  routePath: string
  kind?: Route["kind"]
  title: string
  body?: string
  headings?: string[]
  extras?: Record<string, string[]>
}): RenderedPage {
  const kind = args.kind ?? "markdown"
  const route: Route = {
    source: `docs${args.routePath === "/" ? "/index" : args.routePath}`,
    path: args.routePath,
    kind,
  }
  return {
    route,
    html: "",
    searchTokens: {
      title: args.title,
      body: args.body ?? "",
      headings: args.headings ?? [],
      extras: args.extras ?? {},
    },
    exports: [],
    hasMermaid: false,
    hasOpenApi: kind === "openapi",
    hasProto: kind === "proto",
  }
}

/**
 * Strip the `window.__AID_SEARCH__=…;` wrapper and return the embedded MiniSearch
 * JSON. The shape is opaque to us, so tests look at the documentStore / storedFields
 * surface rather than asserting on inverted-index internals.
 */
function extractIndex(source: string): {
  storedFields: Record<string, Record<string, unknown>>
} {
  const prefix = "window.__AID_SEARCH__="
  expect(source.startsWith(prefix)).toBe(true)
  expect(source.endsWith(";")).toBe(true)
  const payload = source.slice(prefix.length, -1)
  const parsed = JSON.parse(payload) as {
    documentCount: number
    storedFields: Record<string, Record<string, unknown>>
  }
  expect(typeof parsed.documentCount).toBe("number")
  return { storedFields: parsed.storedFields }
}

describe("buildSearchIndex — gating", () => {
  test("returns null when search.enabled is false", () => {
    const ctx = makeCtx({ searchEnabled: false })
    const result = buildSearchIndex(ctx, [
      makePage({ routePath: "/", title: "Home", body: "Welcome." }),
    ])
    expect(result).toBeNull()
  })

  test("returns a result with default config", () => {
    const ctx = makeCtx()
    const result = buildSearchIndex(ctx, [
      makePage({ routePath: "/", title: "Home", body: "Welcome." }),
    ])
    expect(result).not.toBeNull()
  })
})

describe("buildSearchIndex — output shape", () => {
  test("emits a hashed `search-index.<hash>.js` filename and matching href", () => {
    const ctx = makeCtx()
    const result = buildSearchIndex(ctx, [
      makePage({ routePath: "/", title: "Home", body: "Welcome." }),
    ])
    expect(result?.filename).toMatch(/^search-index\.[0-9a-f]{8}\.js$/)
    expect(result?.href).toBe(`/${result?.filename}`)
  })

  test("non-default base_path is prepended to the href but not the filename", () => {
    const ctx = makeCtx({ base_path: "/docs" })
    const result = buildSearchIndex(ctx, [
      makePage({ routePath: "/", title: "Home", body: "Welcome." }),
    ])
    expect(result?.filename).toMatch(/^search-index\.[0-9a-f]{8}\.js$/)
    expect(result?.href).toBe(`/docs/${result?.filename}`)
  })

  test("source assigns window.__AID_SEARCH__ to a valid MiniSearch JSON object", () => {
    const ctx = makeCtx()
    const result = buildSearchIndex(ctx, [
      makePage({ routePath: "/", title: "Home", body: "Welcome." }),
    ])
    if (!result) {
      throw new Error("expected result")
    }
    const { storedFields } = extractIndex(result.source)
    expect(Object.keys(storedFields).length).toBeGreaterThan(0)
  })

  test("identical inputs produce a deterministic hash", () => {
    const ctx = makeCtx()
    const pages = [makePage({ routePath: "/", title: "Home", body: "Welcome." })]
    const a = buildSearchIndex(ctx, pages)
    const b = buildSearchIndex(ctx, pages)
    expect(a?.filename).toBe(b?.filename)
  })
})

describe("buildSearchIndex — indexed documents", () => {
  test("indexes markdown, html, openapi, and proto pages", () => {
    const ctx = makeCtx()
    const result = buildSearchIndex(ctx, [
      makePage({ routePath: "/", title: "Home", body: "Welcome.", kind: "markdown" }),
      makePage({ routePath: "/about", title: "About", body: "<p>x</p>", kind: "html" }),
      makePage({ routePath: "/api", title: "API", kind: "openapi" }),
      makePage({ routePath: "/events", title: "Events", kind: "proto" }),
    ])
    if (!result) {
      throw new Error("expected result")
    }
    const { storedFields } = extractIndex(result.source)
    const types = Object.values(storedFields)
      .map((d) => d.type)
      .sort() as string[]
    expect(types).toEqual(["html", "markdown", "openapi", "proto"])
  })

  test("stored fields per document carry type, title, and url", () => {
    const ctx = makeCtx()
    const result = buildSearchIndex(ctx, [
      makePage({ routePath: "/guides/intro", title: "Intro", body: "Hello." }),
    ])
    if (!result) {
      throw new Error("expected result")
    }
    const { storedFields } = extractIndex(result.source)
    const doc = Object.values(storedFields)[0] as
      | { type: string; title: string; url: string }
      | undefined
    expect(doc?.type).toBe("markdown")
    expect(doc?.title).toBe("Intro")
    expect(doc?.url).toBe("/guides/intro")
  })

  test("root route url collapses to base_path", () => {
    const ctx = makeCtx({ base_path: "/docs" })
    const result = buildSearchIndex(ctx, [makePage({ routePath: "/", title: "Home" })])
    if (!result) {
      throw new Error("expected result")
    }
    const { storedFields } = extractIndex(result.source)
    const doc = Object.values(storedFields)[0] as { url: string } | undefined
    expect(doc?.url).toBe("/docs")
  })

  test("nested routes are joined under base_path", () => {
    const ctx = makeCtx({ base_path: "/docs" })
    const result = buildSearchIndex(ctx, [makePage({ routePath: "/guides/intro", title: "Intro" })])
    if (!result) {
      throw new Error("expected result")
    }
    const { storedFields } = extractIndex(result.source)
    const doc = Object.values(storedFields)[0] as { url: string } | undefined
    expect(doc?.url).toBe("/docs/guides/intro")
  })

  test("extras dict is flattened into the indexed `extras` field", async () => {
    const ctx = makeCtx()
    const result = buildSearchIndex(ctx, [
      makePage({
        routePath: "/api",
        kind: "openapi",
        title: "API",
        extras: {
          operationIds: ["listPets", "getPet"],
          schemas: ["Pet"],
        },
      }),
    ])
    if (!result) {
      throw new Error("expected result")
    }
    // Tokens land in the search index — easiest way to verify is to load the
    // serialized form into MiniSearch and run an actual query.
    const MiniSearch = (await import("minisearch")).default
    const payload = result.source.slice("window.__AID_SEARCH__=".length, -1)
    const ms = (
      MiniSearch as unknown as {
        loadJSON: (
          json: string,
          options: { fields: string[]; storeFields: string[] },
        ) => { search: (q: string) => Array<Record<string, unknown>> }
      }
    ).loadJSON(payload, {
      fields: ["title", "headings", "body", "extras"],
      storeFields: ["type", "title", "url"],
    })
    const hits = ms.search("listPets")
    expect(hits.length).toBeGreaterThan(0)
    expect(hits[0]?.title).toBe("API")
  })
})
