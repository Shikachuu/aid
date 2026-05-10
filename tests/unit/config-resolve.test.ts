import { describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { findUserConfig, parseConfigFile } from "../../src/lint/config-resolve"

const tmp = (): string => mkdtempSync(join(tmpdir(), "aid-cfg-"))

describe("findUserConfig", () => {
  test("returns null when no candidates exist", async () => {
    const dir = tmp()
    try {
      expect(await findUserConfig(dir, [".markdownlint.json"])).toBeNull()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test("walks up to parent directories", async () => {
    const root = tmp()
    const sub = join(root, "a", "b")
    mkdirSync(sub, { recursive: true })
    await Bun.write(join(root, ".markdownlint.json"), "{}")
    try {
      const found = await findUserConfig(sub, [".markdownlint.json"])
      expect(found).toBe(join(root, ".markdownlint.json"))
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test("stops at .git boundary", async () => {
    const root = tmp()
    const sub = join(root, "repo", "src")
    mkdirSync(sub, { recursive: true })
    mkdirSync(join(root, "repo", ".git"), { recursive: true })
    await Bun.write(join(root, ".markdownlint.json"), "{}")
    try {
      const found = await findUserConfig(sub, [".markdownlint.json"])
      expect(found).toBeNull()
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe("parseConfigFile", () => {
  test("parses JSON", async () => {
    const dir = tmp()
    const path = join(dir, "c.json")
    await Bun.write(path, '{"a":1}')
    try {
      expect(await parseConfigFile(path)).toEqual({ a: 1 })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test("parses JSON with comments", async () => {
    const dir = tmp()
    const path = join(dir, "c.jsonc")
    await Bun.write(path, '// comment\n{"a":1 /* inline */}')
    try {
      expect(await parseConfigFile(path)).toEqual({ a: 1 })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test("parses YAML", async () => {
    const dir = tmp()
    const path = join(dir, "c.yaml")
    await Bun.write(path, "a: 1\nb: hello\n")
    try {
      expect(await parseConfigFile(path)).toEqual({ a: 1, b: "hello" })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
