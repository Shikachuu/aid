import { describe, expect, test } from "bun:test"
import { deriveDarkPalette } from "../../src/core/dark-mode"

describe("deriveDarkPalette", () => {
  test("inverts neutral tokens into the 12%-100% band and keeps C/H", () => {
    const result = deriveDarkPalette(
      `@theme { --color-bg: oklch(99% 0 0); --color-text: oklch(20% 0 0); --color-line: oklch(90% 0.01 200); }`,
    )
    expect(result.darkBlock).toContain("--color-bg: oklch(12.88% 0 0);")
    expect(result.darkBlock).toContain("--color-text: oklch(82.4% 0 0);")
    expect(result.darkBlock).toContain("--color-line: oklch(20.8% 0.01 200);")
    expect(result.warnings).toEqual([])
  })

  test("mirrors saturated mid and dark tones into the 70%-85% band", () => {
    const result = deriveDarkPalette(
      `@theme { --color-accent: oklch(55% 0.15 250); --color-ink: oklch(10% 0.2 30); --color-tint: oklch(85% 0.1 200); }`,
    )
    expect(result.darkBlock).toContain("--color-accent: oklch(70% 0.15 250);")
    expect(result.darkBlock).toContain("--color-ink: oklch(85% 0.2 30);")
    expect(result.darkBlock).toContain("--color-tint: oklch(25.2% 0.1 200);")
  })

  test("preserves alpha channel", () => {
    const result = deriveDarkPalette(`@theme { --color-foo: oklch(60% 0.18 320 / 0.8); }`)
    expect(result.darkBlock).toContain("--color-foo: oklch(70% 0.18 320 / 0.8);")
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
    const css = `@theme { --color-a: oklch(70% 0.1 100); }\n@theme { --color-b: oklch(30% 0 0); }`
    const result = deriveDarkPalette(css)
    expect(result.darkBlock).toContain("--color-a: oklch(70% 0.1 100);")
    expect(result.darkBlock).toContain("--color-b: oklch(73.6% 0 0);")
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
    expect(result.darkBlock).toContain("--color-foo: oklch(70% 0.1 200);")
  })

  test("ignores an @theme inside a comment", () => {
    expect(deriveDarkPalette("/* @theme { --color-foo: oklch(80% 0.1 200); } */").darkBlock).toBe(
      "",
    )
  })
})
