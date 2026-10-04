import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { watchContent } from "../../src/dev/watcher"
import { makeCtx } from "../helpers"

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "aid-watch-"))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

const ctx = () => makeCtx(dir, { dir: { templates: "templates" } })

describe("watchContent", () => {
  test("skips inputs that do not exist", () => {
    expect(() =>
      watchContent(ctx(), join(dir, "aid.yaml"), [join(dir, "missing.css")], () => {}).close(),
    ).not.toThrow()
  })

  test("throws watch errors other than ENOENT", async () => {
    await Bun.write(join(dir, "file"), "")
    expect(() =>
      watchContent(
        makeCtx(dir, { dir: { content: "file/docs" } }),
        join(dir, "aid.yaml"),
        [],
        () => {},
      ),
    ).toThrow(expect.objectContaining({ code: "ENOTDIR" }))
  })

  test("reports a change to the config file it was given", async () => {
    mkdirSync(join(dir, "docs"))
    const configPath = join(dir, "custom.yml")
    await Bun.write(configPath, "title: a\n")
    const changed = Promise.withResolvers<boolean>()
    const handle = watchContent(ctx(), configPath, [], changed.resolve)
    try {
      for (let i = 0; i < 20; i++) {
        await Bun.write(configPath, `title: ${i}\n`)
        const fired = await Promise.race([changed.promise, Bun.sleep(100)])
        if (fired !== undefined) {
          expect(fired).toBe(true)
          return
        }
      }
      throw new Error("watcher never reported the config change")
    } finally {
      handle.close()
    }
  })
})
