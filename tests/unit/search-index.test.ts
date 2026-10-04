import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import MiniSearch from "minisearch"
import { buildSearchIndex } from "../../src/core/search-index"
import { SEARCH_OPTIONS } from "../../src/core/search-options"
import type { BuildContext, RenderedPage, Route } from "../../src/core/types"
import { makeCtx } from "../helpers"

let cwd: string

beforeEach(async () => {
  cwd = await mkdtemp(path.join(tmpdir(), "aid-search-"))
})

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true })
})

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

function storedDocs(ctx: BuildContext, pages: RenderedPage[]) {
  const result = buildSearchIndex(ctx, pages)
  if (!result) {
    throw new Error("expected result")
  }
  const prefix = "window.__AID_SEARCH__="
  expect(result.source.startsWith(prefix)).toBe(true)
  expect(result.source.endsWith(";")).toBe(true)
  const parsed = JSON.parse(result.source.slice(prefix.length, -1)) as {
    storedFields: Record<string, { type: string; title: string; url: string }>
  }
  return Object.values(parsed.storedFields)
}

describe("buildSearchIndex — gating", () => {
  test("returns null when search.enabled is false", () => {
    const ctx = makeCtx(cwd, { search: { enabled: false } })
    const result = buildSearchIndex(ctx, [
      makePage({ routePath: "/", title: "Home", body: "Welcome." }),
    ])
    expect(result).toBeNull()
  })
})

describe("buildSearchIndex — output shape", () => {
  test("emits a hashed `search-index.<hash>.js` filename and matching href", () => {
    const ctx = makeCtx(cwd)
    const result = buildSearchIndex(ctx, [
      makePage({ routePath: "/", title: "Home", body: "Welcome." }),
    ])
    expect(result?.filename).toMatch(/^search-index\.[0-9a-f]{8}\.js$/)
    expect(result?.href).toBe(`/${result?.filename}`)
  })

  test("non-default base_path is prepended to the href but not the filename", () => {
    const ctx = makeCtx(cwd, { base_path: "/docs" })
    const result = buildSearchIndex(ctx, [
      makePage({ routePath: "/", title: "Home", body: "Welcome." }),
    ])
    expect(result?.filename).toMatch(/^search-index\.[0-9a-f]{8}\.js$/)
    expect(result?.href).toBe(`/docs/${result?.filename}`)
  })

  test("identical inputs produce a deterministic hash", () => {
    const ctx = makeCtx(cwd)
    const pages = [makePage({ routePath: "/", title: "Home", body: "Welcome." })]
    const a = buildSearchIndex(ctx, pages)
    const b = buildSearchIndex(ctx, pages)
    expect(a?.filename).toBe(b?.filename)
  })
})

describe("buildSearchIndex — indexed documents", () => {
  test("indexes markdown, html, openapi, and proto pages", () => {
    const docs = storedDocs(makeCtx(cwd), [
      makePage({ routePath: "/", title: "Home", body: "Welcome.", kind: "markdown" }),
      makePage({ routePath: "/about", title: "About", body: "<p>x</p>", kind: "html" }),
      makePage({ routePath: "/api", title: "API", kind: "openapi" }),
      makePage({ routePath: "/events", title: "Events", kind: "proto" }),
    ])
    expect(docs.map((d) => d.type).sort()).toEqual(["html", "markdown", "openapi", "proto"])
  })

  test("stored fields per document carry type, title, and url", () => {
    const [doc] = storedDocs(makeCtx(cwd), [
      makePage({ routePath: "/guides/intro", title: "Intro", body: "Hello." }),
    ])
    expect(doc).toEqual({ type: "markdown", title: "Intro", url: "/guides/intro" })
  })

  test("root route url collapses to base_path", () => {
    const [doc] = storedDocs(makeCtx(cwd, { base_path: "/docs" }), [
      makePage({ routePath: "/", title: "Home" }),
    ])
    expect(doc?.url).toBe("/docs")
  })

  test("nested routes are joined under base_path", () => {
    const [doc] = storedDocs(makeCtx(cwd, { base_path: "/docs" }), [
      makePage({ routePath: "/guides/intro", title: "Intro" }),
    ])
    expect(doc?.url).toBe("/docs/guides/intro")
  })

  test("extras dict is flattened into the indexed `extras` field", () => {
    const result = buildSearchIndex(makeCtx(cwd), [
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
    // Tokens land in the search index — easiest way to verify is to load the
    // serialized form into MiniSearch and run an actual query.
    const payload = result?.source.slice("window.__AID_SEARCH__=".length, -1) ?? ""
    const hits = MiniSearch.loadJSON(payload, SEARCH_OPTIONS).search("listPets")
    expect(hits.length).toBeGreaterThan(0)
    expect(hits[0]?.title).toBe("API")
  })
})
