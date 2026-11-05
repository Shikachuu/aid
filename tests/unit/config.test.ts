import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { AidConfigSchema, buildContext, loadConfig } from "../../src/core/config"

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
      jsonschema: 1.5,
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

describe("base_path", () => {
  test.each([
    ["/", "/"],
    ["/docs", "/docs"],
    ["/docs/", "/docs"],
    ["/a/b//", "/a/b"],
  ])("normalizes %j to %j", (input, expected) => {
    expect(AidConfigSchema.parse({ name: "T", base_path: input }).base_path).toBe(expected)
  })

  test.each(["docs", "", "//", "//evil.example", "javascript:alert(1)", "/a b", "/a?b", "/a#b"])(
    "rejects %j",
    (input) => {
      expect(() => AidConfigSchema.parse({ name: "T", base_path: input })).toThrow(/base_path/)
    },
  )
})

describe("base_url", () => {
  test.each(["https://docs.example.com", "https://docs.example.com/", "http://localhost:8080"])(
    "accepts the origin %s",
    (input) => {
      expect(AidConfigSchema.parse({ name: "T", base_url: input }).base_url).toBe(input)
    },
  )

  test.each([
    "https://example.com/docs",
    "https://example.com/?v=1",
    "https://example.com/#top",
    "https://:secret@example.com",
    "ftp://example.com",
    "example.com",
  ])("rejects %s", (input) => {
    expect(() => AidConfigSchema.parse({ name: "T", base_url: input })).toThrow(/base_url/)
  })
})

describe("unknown keys", () => {
  test.each([
    ["a top-level typo", { base_pth: "/docs" }],
    ["a nested typo", { dir: { outptu: "out" } }],
    ["a search weights typo", { search: { weights: { markdwn: 2 } } }],
  ])("rejects %s", (_label, raw) => {
    expect(() => AidConfigSchema.parse({ name: "T", ...raw })).toThrow(/Unrecognized key/)
  })
})

describe("loadConfig", () => {
  let dir: string

  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "aid-load-config-"))
    await mkdir(path.join(dir, "folder.yaml"))
    await Bun.write(path.join(dir, "empty.yaml"), "# only a comment\n")
    await Bun.write(path.join(dir, "broken.yaml"), "name: [\n")
    await Bun.write(path.join(dir, "typo.yaml"), "name: T\non_broken_link: warn\n")
    await Bun.write(path.join(dir, "other", "aid.yml"), "name: T\n")
  })

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  test.each([
    ["a missing file", "missing.yaml", /^aid: config file .*missing\.yaml not found\.$/],
    ["a directory", "folder.yaml", /^aid: config path .*folder\.yaml is a directory/],
    ["an empty file", "empty.yaml", /^aid: .*empty\.yaml is empty/],
    ["invalid YAML", "broken.yaml", /^aid: .*broken\.yaml is not valid YAML/],
    [
      "an unknown key",
      "typo.yaml",
      /^aid: invalid config .*typo\.yaml: \(root\): Unrecognized key: "on_broken_link"$/,
    ],
  ])("reports %s on one line naming the file", async (_label, name, message) => {
    const err = (await loadConfig(path.join(dir, name)).catch((e: unknown) => e)) as Error
    expect(err.message).toMatch(message)
    expect(err.message).not.toContain("\n")
  })

  test("suggests aid.yml when aid.yaml is missing next to it", async () => {
    const err = (await loadConfig(path.join(dir, "other", "aid.yaml")).catch(
      (e: unknown) => e,
    )) as Error
    expect(err.message).toContain("Found aid.yml next to it; pass -f aid.yml.")
  })
})

describe("published JSON Schema", () => {
  test("requires only name, so a minimal aid.yaml validates in editors", async () => {
    const schema = await Bun.file(`${import.meta.dir}/../../schemas/aid.schema.json`).json()
    expect(schema.required).toEqual(["name"])
    for (const key of ["dir", "theme", "search", "dev"]) {
      expect(schema.properties[key].required).toBeUndefined()
    }
  })
})

describe("buildContext output dir", () => {
  const cwd = "/project"
  const ctxFor = (dir: Record<string, string>) =>
    buildContext(AidConfigSchema.parse({ name: "T", dir }), cwd)

  test.each([
    ["the project dir", { output: "." }],
    ["an empty path", { output: "" }],
    ["the parent dir", { output: ".." }],
    ["an absolute path outside the project", { output: "/" }],
    ["the content dir", { output: "docs" }],
    ["a dir inside content", { output: "docs/dist" }],
    ["a dir that contains content", { content: "site/docs", output: "site" }],
    ["the static dir", { output: "static" }],
    ["the templates dir", { templates: "tpl", output: "tpl" }],
  ])("rejects %s", (_label, dir) => {
    expect(() => ctxFor(dir)).toThrow(/aid: dir.output/)
  })

  test("allows a plain build into a sibling directory outside the project", () => {
    expect(ctxFor({ output: "../public" }).outputDir).toBe("/public")
  })

  test("accepts a dir of its own and resolves absolute values", () => {
    expect(ctxFor({ output: "build/site" }).outputDir).toBe("/project/build/site")
    expect(ctxFor({ output: "/project/out" }).outputDir).toBe("/project/out")
  })
})
