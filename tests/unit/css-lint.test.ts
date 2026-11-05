import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { FORMAT_TOOLS, formatAll } from "../../src/fmt/orchestrate"
import { lintCss } from "../../src/lint/css"
import { parseFilter, renderPretty } from "../../src/lint/diagnostics"
import { lintAll } from "../../src/lint/orchestrate"

const NBSP = String.fromCodePoint(0xa0)

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "aid-css-lint-"))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

const lint = async (css: string, name = "a.css") => {
  const file = join(dir, name)
  await Bun.write(file, css)
  return lintCss([file])
}

const findings = async (css: string) =>
  (await lint(css)).diagnostics.map((d) => `${d.line}:${d.code}`)

describe("lintCss", () => {
  test("returns ok:true when no files passed", async () => {
    const result = await lintCss([])
    expect(result).toEqual({ tool: "css", ok: true, diagnostics: [] })
  })

  test("reports nothing for valid modern CSS and Tailwind directives", async () => {
    const result = await lint(
      [
        "@theme { --color-brand: oklch(55% 0.13 175); }",
        "@utility tab-4 { tab-size: 4; }",
        "@custom-variant dark (&:where(.dark, .dark *));",
        '@source "./**/*.{ts,tsx}";',
        ".a {",
        "  @apply px-4;",
        "  text-wrap: balance;",
        "  word-break: auto-phrase;",
        "  field-sizing: content;",
        "  -webkit-font-smoothing: antialiased;",
        "  margin: var(--m);",
        "  padding: --spacing(4);",
        "  color: --theme(--color-brand);",
        "  font-family: Inter, sans-serif;",
        "  transition: opacity 1s allow-discrete;",
        "  cursor: -webkit-grab;",
        "  image-rendering: -webkit-optimize-contrast;",
        `  content: "a${NBSP}b";`,
        "  &:hover { color: red; }",
        "}",
        "my-element::scroll-marker, :host-context(.x) svg foreignObject { color: red; }",
        "@media (min-width: 640px) and (prefers-reduced-motion: reduce) { .b { color: red; } }",
        "@container (width > 30em) { .c { color: red; } }",
        "@font-face { font-family: X; src: url(x.woff2); font-display: swap; }",
      ].join("\n"),
    )
    expect(result.diagnostics).toEqual([])
    expect(result.ok).toBe(true)
  })

  test("reports unknown properties, values, and units with their line", async () => {
    const out = await findings(".a {\n  colr: red;\n  display: flexx;\n  width: 10pxx;\n}\n")
    expect(out).toEqual([
      "2:property-no-unknown",
      "3:declaration-property-value-no-unknown",
      "4:declaration-property-value-no-unknown",
    ])
  })

  test("reports a declared custom property used without var()", async () => {
    const out = await findings(":root { --brand: red; }\n.a { color: --brand; }\n")
    expect(out).toEqual(["2:custom-property-no-missing-var-function"])
  })

  test("reads a custom property declared only in a comment as undeclared", async () => {
    const out = await findings(".b { /* --z: 1; */ color: --z; }\n")
    expect(out).toEqual(["1:declaration-property-value-no-unknown"])
  })

  test("accepts Tailwind import options and leaves partials to the entry file", async () => {
    expect(await findings('@import "tailwindcss" source(none);\n')).toEqual([])
    expect(await findings(".x { @apply nope-utility; }\n")).toEqual([])
  })

  test("reports an unclosed comment, block, or string", async () => {
    expect(await findings(".a { color: red; }\n/* note\n.b { color: red; }\n")).toEqual([
      "2:css-syntax-error",
    ])
    expect(await findings(".a { color: red; }\n.b {\n  color: red;\n")).toEqual([
      "2:css-syntax-error",
    ])
    expect(await findings('.a { content: "abc\n}\n')).toEqual(["1:string-no-newline"])
  })

  test("counts an !important declaration as a duplicate of a normal one", async () => {
    const out = await findings(".a {\n  color: red;\n  width: 1px;\n  color: blue !important;\n}\n")
    expect(out).toEqual(["4:declaration-block-no-duplicate-properties"])
  })

  test("reports unknown selectors and at-rules, but not Tailwind directives", async () => {
    const out = await findings(
      "@tailwnd base;\n@theme { --x: 1; }\n.y:hovr { color: red; }\na::befor { color: red; }\ndvi { color: red; }\na > > b { color: red; }\n",
    )
    expect(out).toEqual([
      "1:at-rule-no-unknown",
      "3:selector-pseudo-class-no-unknown",
      "4:selector-pseudo-element-no-unknown",
      "5:selector-type-no-unknown",
      "6:selector-no-invalid",
    ])
  })

  test("reports unknown media features and @font-face descriptors", async () => {
    const out = await findings(
      "@media (min-widht: 1px) { .a { color: red; } }\n@font-face { font-famly: X; }\n",
    )
    expect(out).toEqual(["1:media-feature-name-no-unknown", "2:at-rule-descriptor-no-unknown"])
  })

  test("lets a consecutive fallback with a different kind of value pass", async () => {
    const out = await findings(
      ".a {\n  color: #fff;\n  color: oklch(50% 0.1 200);\n  width: 1px;\n  height: 1px;\n  width: 2px;\n}\n",
    )
    expect(out).toEqual(["6:declaration-block-no-duplicate-properties"])
  })

  test("reports duplicates, shorthand overrides, and font family problems as warnings", async () => {
    const result = await lint(
      [
        ".a {",
        "  --x: 1;",
        "  --x: 2;",
        "  padding-left: 1px;",
        "  padding: 0;",
        "  font-family: Inter, inter;",
        "}",
        ".a { color: red; }",
        ".b {}",
        "@keyframes k { from { opacity: 0 !important; } from { opacity: 1; } }",
        '@import "x.css";',
      ].join("\n"),
    )
    expect(result.diagnostics.map((d) => `${d.line}:${d.code}`)).toEqual([
      "3:declaration-block-no-duplicate-custom-properties",
      "5:declaration-block-no-shorthand-property-overrides",
      "6:font-family-no-duplicate-names",
      "6:font-family-no-missing-generic-family-keyword",
      "8:no-duplicate-selectors",
      "9:block-no-empty",
      "10:keyframe-block-no-duplicate-selectors",
      "10:keyframe-declaration-no-important",
      "11:no-invalid-position-at-import-rule",
    ])
    expect(result.ok).toBe(false)
    expect(result.diagnostics.filter((d) => d.severity === "error").map((d) => d.code)).toEqual([
      "no-invalid-position-at-import-rule",
    ])
  })

  test("reports text problems outside strings only", async () => {
    const out = await findings(`/* */\n.a${NBSP}{ color: red; }\n@source "./**/*.ts";\n`)
    expect(out).toEqual(["1:comment-no-empty", "2:no-irregular-whitespace"])
    expect(await findings("  \n")).toEqual(["undefined:no-empty-source"])
  })

  test("reports Tailwind's compile error at the offending utility", async () => {
    const result = await lint('@import "tailwindcss";\n\n.btn {\n  @apply px-4 pyy-2;\n}\n')
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        line: 4,
        col: 15,
        severity: "error",
        code: "tailwind",
        message: "Cannot apply unknown utility class `pyy-2`",
      }),
    ])
  })

  test("places Tailwind errors at the @apply, variant, or theme value that failed", async () => {
    const position = async (css: string) => {
      const [d] = (await lint(css)).diagnostics
      return `${d?.line}:${d?.code}`
    }
    const entry = '@import "tailwindcss";\n'
    expect(await position(`${entry}.pyy-2 { color: red; }\n.b { @apply pyy-2; }\n`)).toBe(
      "3:tailwind",
    )
    expect(await position(`${entry}.c {\n  @variant hoverr { color: red; }\n}\n`)).toBe(
      "3:tailwind",
    )
    expect(await position(`${entry}.d {\n  color: --theme(--color-nope);\n}\n`)).toBe("3:tailwind")
  })

  test("compiles a stylesheet that imports aid/theme", async () => {
    const result = await lint('@import "tailwindcss";\n@import "aid/theme";\n')
    expect(result.diagnostics).toEqual([])
  })
})

describe("css in the lint and fmt pipelines", () => {
  test("lint reports CSS through the css tool only, not bun", async () => {
    await Bun.write(join(dir, "a.css"), ".a { colr: red; }\n")
    const report = await lintAll({ dir, fix: false, filter: null })
    const byTool = Object.fromEntries(report.results.map((r) => [r.tool, r.diagnostics.length]))
    expect(byTool.css).toBe(1)
    expect(byTool.bun).toBe(0)
    expect(renderPretty(report.results)).toContain("(md 0, openapi 0, bun 0, css 1, proto 0)")
  })

  test("fmt rejects css and unknown names in --filter instead of running every tool", () => {
    expect(() => parseFilter("css", FORMAT_TOOLS)).toThrow(/unknown --filter tool css/)
    expect(() => parseFilter("css,md", FORMAT_TOOLS)).toThrow(
      /Choose from: md, openapi, bun, proto/,
    )
    expect(() => parseFilter("mdd")).toThrow(/unknown --filter tool mdd/)
    expect(parseFilter("css")).toEqual(new Set(["css"]))
    expect(parseFilter(" md , bun ")).toEqual(new Set(["md", "bun"]))
    expect(parseFilter(undefined)).toBeNull()
    expect(parseFilter("")).toBeNull()
  })

  test("fmt has no css tool", async () => {
    await Bun.write(join(dir, "a.css"), ".a{color:red}\n")
    const report = await formatAll({ dir, check: true, filter: null })
    expect(report.results.map((r) => r.tool)).not.toContain("css")
    expect(renderPretty(report.results)).not.toMatch(/\bcss \d/)
  })
})
