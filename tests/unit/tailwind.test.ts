import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { AidConfigSchema } from "../../src/core/config"
import { compileTailwind } from "../../src/core/tailwind"
import type { BuildContext } from "../../src/core/types"

let cwd: string

beforeEach(async () => {
  cwd = await mkdtemp(path.join(tmpdir(), "aid-tailwind-"))
})

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true })
})

async function makeCtx(
  overrides: { dark_mode?: "auto" | "manual" | "off"; stylesheet?: string } = {},
) {
  const config = AidConfigSchema.parse({
    name: "test",
    stylesheet: overrides.stylesheet ?? "main.css",
    theme: { dark_mode: overrides.dark_mode ?? "auto" },
  })
  const ctx: BuildContext = {
    config,
    cwd,
    contentDir: path.join(cwd, config.dir.content),
    outputDir: path.join(cwd, config.dir.output),
    templatesDir: null,
    staticDir: path.join(cwd, config.dir.static),
  }
  return ctx
}

function stubHtml(classes: string): string {
  return `<div class="${classes}">x</div>`
}

describe("compileTailwind", () => {
  test("compiles bundled defaults when no user main.css exists", async () => {
    const ctx = await makeCtx()
    const { css } = await compileTailwind({
      ctx,
      htmlContents: [stubHtml("bg-aid-bg text-aid-text")],
    })
    expect(css.length).toBeGreaterThan(0)
    expect(css).toContain("--color-aid-bg")
    expect(css).toContain(".bg-aid-bg")
    expect(css).toContain(".text-aid-text")
  })

  test("strips dark @media block from source when dark_mode is off", async () => {
    await Bun.write(
      path.join(cwd, "main.css"),
      `@import "tailwindcss";\n@theme {\n  --color-aid-bg: oklch(99% 0 0);\n}\n@media (prefers-color-scheme: dark) {\n  :root {\n    --color-test-marker: oklch(42% 0 0);\n  }\n}\n`,
    )
    const ctx = await makeCtx({ dark_mode: "off" })
    const { css } = await compileTailwind({ ctx, htmlContents: [stubHtml("bg-aid-bg")] })
    expect(css).not.toContain("oklch(42% 0 0)")
  })

  test("keeps dark tokens in source when dark_mode is manual", async () => {
    await Bun.write(
      path.join(cwd, "main.css"),
      `@import "tailwindcss";\n@theme {\n  --color-aid-bg: oklch(99% 0 0);\n}\n@media (prefers-color-scheme: dark) {\n  :root {\n    --color-test-marker: oklch(42% 0 0);\n  }\n}\n`,
    )
    const ctx = await makeCtx({ dark_mode: "manual" })
    const { css } = await compileTailwind({ ctx, htmlContents: [stubHtml("bg-aid-bg")] })
    expect(css).toContain("oklch(42% 0 0)")
  })

  test("auto-derives dark tokens from light @theme", async () => {
    const ctx = await makeCtx({ dark_mode: "auto" })
    const { css } = await compileTailwind({ ctx, htmlContents: [stubHtml("bg-aid-bg")] })
    expect(css).toContain("oklch(1% 0 0)")
  })

  test("user main.css replaces bundled when present", async () => {
    await Bun.write(
      path.join(cwd, "main.css"),
      `@import "tailwindcss";\n@theme {\n  --color-aid-custom: oklch(50% 0.2 10);\n}\n`,
    )
    const ctx = await makeCtx()
    const { css } = await compileTailwind({ ctx, htmlContents: [stubHtml("bg-aid-custom")] })
    expect(css).toContain("--color-aid-custom")
    expect(css).toContain(".bg-aid-custom")
    // Bundled-only token must not appear.
    expect(css).not.toContain("--color-aid-accent")
  })

  test("returns dependencies as string array", async () => {
    const ctx = await makeCtx()
    const { dependencies } = await compileTailwind({ ctx, htmlContents: [stubHtml("bg-aid-bg")] })
    expect(Array.isArray(dependencies)).toBe(true)
  })

  test("safelist forces class generation when no source mentions it", async () => {
    const ctx = await makeCtx()
    const { css } = await compileTailwind({ ctx, safelist: ["bg-aid-bg"] })
    expect(css).toContain(".bg-aid-bg")
  })

  test("resolves user @import relative to the user main.css", async () => {
    const ctx = await makeCtx()
    await Bun.write(
      path.join(cwd, "extra.css"),
      `@theme {\n  --color-aid-extra: oklch(50% 0.2 100);\n}\n`,
    )
    await Bun.write(path.join(cwd, "main.css"), `@import "tailwindcss";\n@import "./extra.css";\n`)
    const { css } = await compileTailwind({ ctx, htmlContents: [stubHtml("bg-aid-extra")] })
    expect(css).toContain("--color-aid-extra")
    expect(css).toContain(".bg-aid-extra")
  })

  test('inlines bundled theme when user main.css contains @import "aid/theme"', async () => {
    await Bun.write(path.join(cwd, "main.css"), `@import "tailwindcss";\n@import "aid/theme";\n`)
    const ctx = await makeCtx()
    const { css } = await compileTailwind({ ctx, htmlContents: [stubHtml("aid-body")] })
    expect(css).toContain(".aid-body")
    expect(css).toContain("--color-aid-bg")
  })

  test("user @theme overrides bundled tokens when imported after", async () => {
    await Bun.write(
      path.join(cwd, "main.css"),
      `@import "tailwindcss";\n@import "aid/theme";\n@theme {\n  --color-aid-accent: oklch(50% 0.2 100);\n}\n`,
    )
    const ctx = await makeCtx()
    const { css } = await compileTailwind({ ctx, htmlContents: [stubHtml("aid-body")] })
    expect(css).toContain("oklch(50% 0.2 100)")
  })

  test('user main.css without @import "aid/theme" gets no bundled content', async () => {
    await Bun.write(
      path.join(cwd, "main.css"),
      `@import "tailwindcss";\n@theme {\n  --color-aid-custom: oklch(40% 0.1 200);\n}\n`,
    )
    const ctx = await makeCtx()
    const { css } = await compileTailwind({ ctx, htmlContents: [stubHtml("aid-body")] })
    expect(css).not.toMatch(/\.aid-body\s*\{/)
    expect(css).toContain("--color-aid-custom")
  })
})
