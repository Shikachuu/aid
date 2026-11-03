import { describe, expect, test } from "bun:test"
import { AidConfigSchema } from "../../src/core/config"

describe("AidConfigSchema", () => {
  test("accepts a minimal config and applies defaults", () => {
    const parsed = AidConfigSchema.parse({ name: "Test" })
    expect(parsed.name).toBe("Test")
    expect(parsed.base_path).toBe("/")
    expect(parsed.stylesheet).toBe("main.css")
    expect(parsed.dir.content).toBe("docs")
    expect(parsed.dir.output).toBe("dist")
    expect(parsed.dir.templates).toBe("")
    expect(parsed.theme.dark_mode).toBe("auto")
    expect(parsed.ai_targets).toEqual(["chatgpt", "claude"])
    expect(parsed.search.enabled).toBe(true)
    expect(parsed.search.typo_tolerance).toBe(0.2)
    expect(parsed.search.weights).toEqual({
      markdown: 1.0,
      html: 1.0,
      openapi: 2.0,
      proto: 1.5,
    })
    expect(parsed.dev.port).toBe(3000)
    expect(parsed.dev.host).toBe("localhost")
    expect(parsed.on_broken_links).toBe("error")
  })

  test("rejects unknown on_broken_links", () => {
    expect(() => AidConfigSchema.parse({ name: "T", on_broken_links: "ignore" })).toThrow()
  })

  test("rejects a missing name", () => {
    expect(() => AidConfigSchema.parse({})).toThrow()
  })

  test("rejects unknown dark_mode", () => {
    expect(() => AidConfigSchema.parse({ name: "T", theme: { dark_mode: "neon" } })).toThrow()
  })

  test("clamps typo_tolerance to [0,1]", () => {
    expect(() => AidConfigSchema.parse({ name: "T", search: { typo_tolerance: 1.5 } })).toThrow()
    expect(() => AidConfigSchema.parse({ name: "T", search: { typo_tolerance: -0.1 } })).toThrow()
  })

  test("preserves user overrides over defaults", () => {
    const parsed = AidConfigSchema.parse({
      name: "T",
      base_path: "/docs",
      ai_targets: ["claude"],
      search: { weights: { openapi: 5.0 } },
    })
    expect(parsed.base_path).toBe("/docs")
    expect(parsed.ai_targets).toEqual(["claude"])
    expect(parsed.search.weights.openapi).toBe(5.0)
    expect(parsed.search.weights.markdown).toBe(1.0)
  })
})
