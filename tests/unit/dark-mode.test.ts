import { describe, expect, test } from "bun:test"
import { deriveDarkPalette } from "../../src/core/dark-mode"

describe("deriveDarkPalette", () => {
  test("inverts L and preserves C/H for a single oklch token", () => {
    const result = deriveDarkPalette(`@theme { --color-foo: oklch(80% 0.1 200); }`)
    expect(result.darkBlock).toContain("--color-foo: oklch(20% 0.1 200);")
    expect(result.warnings).toEqual([])
  })

  test("preserves alpha channel", () => {
    const result = deriveDarkPalette(`@theme { --color-foo: oklch(60% 0.18 320 / 0.8); }`)
    expect(result.darkBlock).toContain("--color-foo: oklch(40% 0.18 320 / 0.8);")
  })

  test("warns and skips hex colours", () => {
    const result = deriveDarkPalette(`@theme { --color-foo: #ff0000; }`)
    expect(result.darkBlock).not.toContain("--color-foo")
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain("--color-foo")
    expect(result.warnings[0]).toContain("oklch")
  })

  test("warns and skips rgb colours", () => {
    const result = deriveDarkPalette(`@theme { --color-foo: rgb(255 0 0); }`)
    expect(result.darkBlock).not.toContain("--color-foo")
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain("--color-foo")
    expect(result.warnings[0]).toContain("oklch")
  })

  test("merges multiple @theme blocks into one :root", () => {
    const css = `@theme { --color-a: oklch(70% 0.1 100); }\n@theme { --color-b: oklch(30% 0.05 200); }`
    const result = deriveDarkPalette(css)
    expect(result.darkBlock).toContain("--color-a: oklch(30% 0.1 100);")
    expect(result.darkBlock).toContain("--color-b: oklch(70% 0.05 200);")
    const mediaMatches = result.darkBlock.match(/@media/g) ?? []
    const rootMatches = result.darkBlock.match(/:root/g) ?? []
    expect(mediaMatches).toHaveLength(1)
    expect(rootMatches).toHaveLength(1)
  })

  test("returns empty darkBlock when no colour tokens", () => {
    const result = deriveDarkPalette(`@theme { --font-foo: sans; }`)
    expect(result.darkBlock).toBe("")
    expect(result.warnings).toEqual([])
  })

  test("silently skips non-color tokens", () => {
    const css = `@theme { --color-a: oklch(50% 0 0); --font-b: sans; --space-c: 1rem; }`
    const result = deriveDarkPalette(css)
    expect(result.darkBlock).toContain("--color-a")
    expect(result.darkBlock).not.toContain("--font-b")
    expect(result.darkBlock).not.toContain("--space-c")
    expect(result.warnings).toEqual([])
  })

  test("a brace inside a string or comment does not end the @theme block", () => {
    const result = deriveDarkPalette(
      `@theme {\n  --font-x: "}";\n  /* } */\n  --color-foo: oklch(80% 0.1 200);\n}`,
    )
    expect(result.darkBlock).toContain("--color-foo: oklch(20% 0.1 200);")
  })

  test("ignores an @theme inside a comment", () => {
    expect(deriveDarkPalette("/* @theme { --color-foo: oklch(80% 0.1 200); } */").darkBlock).toBe(
      "",
    )
  })
})
