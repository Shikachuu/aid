import { describe, expect, test } from "bun:test"
import path from "node:path"
import { outputPathForExport, outputPathForRoute } from "../../src/core/pipeline"
import type { Route } from "../../src/core/types"
import { makeCtx } from "../helpers"

const ctx = makeCtx("/repo")

function route(p: string): Route {
  return { source: "irrelevant", path: p, kind: "markdown" }
}

describe("outputPathForRoute", () => {
  test("root collapses to index.html", () => {
    expect(outputPathForRoute(route("/"), ctx)).toBe(path.join("/repo/dist", "index.html"))
  })

  test("single-segment route becomes nested index.html", () => {
    expect(outputPathForRoute(route("/foo"), ctx)).toBe(
      path.join("/repo/dist", "foo", "index.html"),
    )
  })

  test("multi-segment route preserves the hierarchy", () => {
    expect(outputPathForRoute(route("/a/b/c"), ctx)).toBe(
      path.join("/repo/dist", "a", "b", "c", "index.html"),
    )
  })
})

describe("outputPathForExport", () => {
  test("root + .md collapses to index.md at the output root", () => {
    expect(outputPathForExport(route("/"), ".md", ctx)).toBe(path.join("/repo/dist", "index.md"))
  })

  test("single-segment route emits a sibling .md, not nested under the folder", () => {
    expect(outputPathForExport(route("/foo"), ".md", ctx)).toBe(path.join("/repo/dist", "foo.md"))
  })

  test("multi-segment route sits next to its folder, parent dirs preserved", () => {
    expect(outputPathForExport(route("/a/b/c"), ".md", ctx)).toBe(
      path.join("/repo/dist", "a", "b", "c.md"),
    )
  })

  test("any suffix is honored, not just .md", () => {
    expect(outputPathForExport(route("/api"), ".json", ctx)).toBe(
      path.join("/repo/dist", "api.json"),
    )
  })
})
