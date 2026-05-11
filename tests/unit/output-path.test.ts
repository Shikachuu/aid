import { describe, expect, test } from "bun:test"
import path from "node:path"
import { AidConfigSchema } from "../../src/core/config"
import { outputPathForExport, outputPathForRoute } from "../../src/core/pipeline"
import type { BuildContext, Route } from "../../src/core/types"

function makeCtx(): BuildContext {
  const config = AidConfigSchema.parse({ name: "test" })
  return {
    config,
    cwd: "/repo",
    contentDir: "/repo/docs",
    outputDir: "/repo/dist",
    templatesDir: null,
    staticDir: "/repo/static",
  }
}

function route(p: string): Route {
  return { source: "irrelevant", path: p, kind: "markdown" }
}

describe("outputPathForRoute", () => {
  test("root collapses to index.html", () => {
    expect(outputPathForRoute(route("/"), makeCtx())).toBe(path.join("/repo/dist", "index.html"))
  })

  test("single-segment route becomes nested index.html", () => {
    expect(outputPathForRoute(route("/foo"), makeCtx())).toBe(
      path.join("/repo/dist", "foo", "index.html"),
    )
  })

  test("multi-segment route preserves the hierarchy", () => {
    expect(outputPathForRoute(route("/a/b/c"), makeCtx())).toBe(
      path.join("/repo/dist", "a", "b", "c", "index.html"),
    )
  })
})

describe("outputPathForExport", () => {
  test("root + .md collapses to index.md at the output root", () => {
    expect(outputPathForExport(route("/"), ".md", makeCtx())).toBe(
      path.join("/repo/dist", "index.md"),
    )
  })

  test("single-segment route emits a sibling .md, not nested under the folder", () => {
    expect(outputPathForExport(route("/foo"), ".md", makeCtx())).toBe(
      path.join("/repo/dist", "foo.md"),
    )
  })

  test("multi-segment route sits next to its folder, parent dirs preserved", () => {
    expect(outputPathForExport(route("/a/b/c"), ".md", makeCtx())).toBe(
      path.join("/repo/dist", "a", "b", "c.md"),
    )
  })

  test("any suffix is honored, not just .md", () => {
    expect(outputPathForExport(route("/api"), ".json", makeCtx())).toBe(
      path.join("/repo/dist", "api.json"),
    )
  })
})
