import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { findUserConfig, parseConfigFile } from "../../src/lint/config-resolve"

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "aid-cfg-"))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe("findUserConfig", () => {
  test("returns null when no candidates exist", async () => {
    expect(await findUserConfig(dir, [".markdownlint.json"])).toBeNull()
  })

  test("walks up to parent directories", async () => {
    const sub = join(dir, "a", "b")
    mkdirSync(sub, { recursive: true })
    await Bun.write(join(dir, ".markdownlint.json"), "{}")
    expect(await findUserConfig(sub, [".markdownlint.json"])).toBe(join(dir, ".markdownlint.json"))
  })

  test("stops at .git boundary", async () => {
    const sub = join(dir, "repo", "src")
    mkdirSync(sub, { recursive: true })
    mkdirSync(join(dir, "repo", ".git"), { recursive: true })
    await Bun.write(join(dir, ".markdownlint.json"), "{}")
    expect(await findUserConfig(sub, [".markdownlint.json"])).toBeNull()
  })
})

describe("parseConfigFile", () => {
  const parse = async (name: string, body: string) => {
    const path = join(dir, name)
    await Bun.write(path, body)
    return parseConfigFile(path)
  }

  test("parses JSON", async () => {
    expect(await parse("c.json", '{"a":1}')).toEqual({ a: 1 })
  })

  test("parses JSON with comments", async () => {
    expect(await parse("c.jsonc", '// comment\n{"a":1 /* inline */}')).toEqual({ a: 1 })
  })

  test("parses JSONC with trailing commas", async () => {
    expect(await parse("c.jsonc", '{"a": [1, 2,], "b": "// not a comment",}')).toEqual({
      a: [1, 2],
      b: "// not a comment",
    })
  })

  test("parses YAML", async () => {
    expect(await parse("c.yaml", "a: 1\nb: hello\n")).toEqual({ a: 1, b: "hello" })
  })
})
