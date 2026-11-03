import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { serveFile } from "../../src/dev/server"

let dist: string

beforeEach(async () => {
  dist = await mkdtemp(path.join(tmpdir(), "aid-serve-"))
  await Bun.write(path.join(dist, "index.html"), "home")
  await Bun.write(path.join(dist, "user.schema", "index.html"), "schema page")
  await Bun.write(path.join(dist, "user.schema.json"), "{}")
})

afterEach(async () => {
  await rm(dist, { recursive: true, force: true })
})

describe("serveFile", () => {
  test("serves a route folder's index.html", async () => {
    expect(await (await serveFile(dist, "/")).text()).toBe("home")
  })

  test("serves a file whose name has an extension", async () => {
    expect(await (await serveFile(dist, "/user.schema.json")).text()).toBe("{}")
  })

  test("serves the index.html of a route whose last segment has a dot", async () => {
    expect(await (await serveFile(dist, "/user.schema")).text()).toBe("schema page")
  })

  test("answers 404 for a missing file and 400 for a path outside dist", async () => {
    expect((await serveFile(dist, "/nope.css")).status).toBe(404)
    expect((await serveFile(dist, "/../etc/passwd")).status).toBe(400)
  })
})
