import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { formatProto } from "../../src/fmt/proto"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { formatWithBun } from "../../src/fmt/bun"
import { formatMarkdown } from "../../src/fmt/markdown"
import { formatOpenApi } from "../../src/fmt/openapi"
import { formatAll } from "../../src/fmt/orchestrate"

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "aid-fmt-"))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe("formatMarkdown", () => {
  test("collapses MD012 blank lines and is idempotent", async () => {
    const file = join(dir, "doc.md")
    await Bun.write(file, "# Title\n\n\n\nbody\n")
    await formatMarkdown([file], dir, { check: false })
    const after = await Bun.file(file).text()
    expect(after).not.toContain("\n\n\n\n")
    await formatMarkdown([file], dir, { check: false })
    const afterSecond = await Bun.file(file).text()
    expect(afterSecond).toBe(after)
  })

  test("--check reports wouldChange without writing", async () => {
    const file = join(dir, "doc.md")
    const original = "# Title\n\n\n\nbody\n"
    await Bun.write(file, original)
    const result = await formatMarkdown([file], dir, { check: true })
    expect(result.ok).toBe(false)
    expect(result.wouldChange).toContain(file)
    expect(await Bun.file(file).text()).toBe(original)
  })

  test("never applies fixes that change what the page says", async () => {
    const file = join(dir, "doc.md")
    const original = [
      "# Title",
      "",
      "line one   ",
      "line two",
      "",
      "Compute a * b * c now.",
      "",
      "```make",
      "all:",
      "\techo hi",
      "```",
      "",
      "[unused]: https://example.com",
      "",
    ].join("\n")
    await Bun.write(file, original)
    await formatMarkdown([file], dir, { check: false })
    expect(await Bun.file(file).text()).toBe(original)
  })
})

describe("formatOpenApi", () => {
  const SPEC = `# Pet store spec
openapi: 3.1.0
info:
  title: Pets   # shown in the header
  version: 1.0
  description: |
    Line one.
    Line two.
x-hex: 0x1F
x-big: 12345678901234567890
x-base: &base
  type: object
x-pet: *base
paths:   {}
`

  test("keeps comments, block scalars, anchors and number spellings", async () => {
    const file = join(dir, "openapi.yaml")
    await Bun.write(file, SPEC)
    const result = await formatOpenApi([file], dir, { check: false })
    expect(result.ok).toBe(true)
    const out = await Bun.file(file).text()
    for (const kept of [
      "# Pet store spec",
      "# shown in the header",
      "version: 1.0",
      "description: |\n    Line one.\n    Line two.",
      "x-big: 12345678901234567890",
      "x-base: &base",
      "x-pet: *base",
    ]) {
      expect(out).toContain(kept)
    }
    expect(out).toContain("paths: {}")
  })

  test("is idempotent", async () => {
    const file = join(dir, "openapi.yaml")
    await Bun.write(file, SPEC)
    await formatOpenApi([file], dir, { check: false })
    const first = await Bun.file(file).text()
    const second = await formatOpenApi([file], dir, { check: true })
    expect(second.wouldChange).toEqual([])
    expect(await Bun.file(file).text()).toBe(first)
  })

  test("leaves JSON specs to the bun tool", async () => {
    const file = join(dir, "openapi.json")
    const original = '{"openapi":"3.0.0","info":{"title":"X","version":1.0},"paths":{}}'
    await Bun.write(file, original)
    const result = await formatOpenApi([file], dir, { check: true })
    expect(result.ok).toBe(true)
    expect(await Bun.file(file).text()).toBe(original)
  })

  test("keeps long strings on one line and formats a spec that ends in a stray ---", async () => {
    const file = join(dir, "openapi.yaml")
    const long = "x".repeat(120)
    await Bun.write(file, `openapi:   3.1.0\ninfo:\n  title: ${long}\n---\n`)
    const result = await formatOpenApi([file], dir, { check: false })
    expect(result.diagnostics).toEqual([])
    const out = await Bun.file(file).text()
    expect(out).toContain(`title: ${long}\n`)
    expect(out).toContain("openapi: 3.1.0")
  })

  test("skips a multi-document file with a warning", async () => {
    const file = join(dir, "openapi.yaml")
    const original = "openapi: 3.1.0\n---\nopenapi:    3.1.0\n"
    await Bun.write(file, original)
    const result = await formatOpenApi([file], dir, { check: false })
    expect(result.ok).toBe(true)
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ file, severity: "warn", code: "openapi/multi-document" }),
    ])
    expect(await Bun.file(file).text()).toBe(original)
  })

  test.each([true, false])(
    "reports an unparseable spec as an error and leaves it untouched (check: %p)",
    async (check) => {
      const file = join(dir, "openapi.yaml")
      const original = "openapi: [3.0.0\n"
      await Bun.write(file, original)
      const result = await formatOpenApi([file], dir, { check })
      expect(result.ok).toBe(false)
      expect(result.diagnostics).toEqual([
        expect.objectContaining({ file, severity: "error", code: "openapi/parse" }),
      ])
      expect(await Bun.file(file).text()).toBe(original)
    },
  )
})

describe("formatWithBun", () => {
  test("formats with the bundled options and is idempotent", async () => {
    const file = join(dir, "x.ts")
    await Bun.write(file, "const   x   =   { a: 'b' };\nconsole.log( x )\n")
    await formatWithBun([file], dir, { check: false })
    const first = await Bun.file(file).text()
    expect(first).toBe('const x = { a: "b" }\nconsole.log(x)\n')
    await formatWithBun([file], dir, { check: false })
    expect(await Bun.file(file).text()).toBe(first)
  })

  test("--check reports wouldChange without writing", async () => {
    const file = join(dir, "x.ts")
    const original = "const   x   =   1\n"
    await Bun.write(file, original)
    await Bun.write(join(dir, "ok.ts"), "export const y = 1\n")
    const result = await formatWithBun([file, join(dir, "ok.ts")], dir, { check: true })
    expect(result.ok).toBe(false)
    expect(result.wouldChange).toEqual([file])
    expect(await Bun.file(file).text()).toBe(original)
  })

  test("uses a project Prettier config instead of the bundled options", async () => {
    await Bun.write(join(dir, ".prettierrc"), '{ "semi": true, "singleQuote": true }\n')
    const file = join(dir, "x.ts")
    await Bun.write(file, 'const x = "a"\n')
    await formatWithBun([file], dir, { check: false })
    expect(await Bun.file(file).text()).toBe("const x = 'a';\n")
  })

  test("reports a file it cannot parse", async () => {
    const file = join(dir, "x.ts")
    await Bun.write(file, "const = 1\n")
    const result = await formatWithBun([file], dir, { check: true })
    expect(result.ok).toBe(false)
    expect(result.diagnostics[0]).toMatchObject({ file, line: 1, code: "bun/format" })
  })
})

describe("formatWithBun --check with other configs", () => {
  for (const [name, content] of [
    [".prettierrc", "{}\n"],
    [".oxfmtrc.json", "{}\n"],
  ] as const) {
    test(`lists the files a ${name} project would reformat`, async () => {
      await Bun.write(join(dir, name), content)
      const file = join(dir, "b.js")
      await Bun.write(file, "const   b = 1\n")
      await Bun.write(join(dir, "c.js"), "export const c = 1;\n")
      const result = await formatWithBun([file, join(dir, "c.js")], dir, { check: true })
      expect(result.ok).toBe(false)
      expect(result.wouldChange).toEqual([file])
    })
  }

  test("fails when bun fmt fails without naming a file", async () => {
    await Bun.write(join(dir, "bunfig.toml"), "[fmt]\nnotAnOption = true\n")
    const file = join(dir, "x.ts")
    await Bun.write(file, "export const x = 1\n")
    const result = await formatWithBun([file], dir, { check: true })
    expect(result.ok).toBe(false)
    expect(result.diagnostics[0]?.code).toBe("bun/format")
  })
})

describe("formatAll orchestrator", () => {
  test("end-to-end format pass over a mixed project", async () => {
    await Bun.write(join(dir, "doc.md"), "# Title\n\n\n\nbody\n")
    await Bun.write(join(dir, "x.ts"), "const   x = 1\n")
    const report = await formatAll({ dir, check: false, filter: null })
    expect(report.results.length).toBeGreaterThan(0)
  })
})

describe("formatProto", () => {
  test.each([true, false])(
    "reports a proto that does not parse as an error, not a would-change (check: %p)",
    async (check) => {
      const file = join(dir, "bad.proto")
      const original = 'syntax = "proto3";\nmessage M{string x=\n'
      await Bun.write(file, original)
      const result = await formatProto([file], dir, { check })
      expect(result.ok).toBe(false)
      expect(result.wouldChange ?? []).toEqual([])
      expect(result.diagnostics).toEqual([
        expect.objectContaining({ file, severity: "error", code: "proto/parse" }),
      ])
      expect(await Bun.file(file).text()).toBe(original)
    },
  )

  test("reports a buf failure such as a broken buf.yaml with buf's message", async () => {
    await Bun.write(join(dir, "buf.yaml"), "version: bogus\n")
    const file = join(dir, "ok.proto")
    await Bun.write(file, 'syntax = "proto3";\npackage ok.v1;\nmessage   M {}\n')
    const result = await formatProto([file], dir, { check: true })
    expect(result.ok).toBe(false)
    expect(result.wouldChange).toEqual([])
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        file,
        code: "proto/format",
        message: expect.stringContaining("bogus"),
      }),
    ])
  })

  test("--check lists an unformatted proto as would-change", async () => {
    const file = join(dir, "ok.proto")
    await Bun.write(file, 'syntax = "proto3";\npackage ok.v1;\nmessage   M {}\n')
    const result = await formatProto([file], dir, { check: true })
    expect(result.wouldChange).toEqual([file])
    expect(result.diagnostics).toEqual([])
  })
})
