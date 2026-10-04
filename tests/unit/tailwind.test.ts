import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { compileTailwind } from "../../src/core/tailwind"
import { makeCtx } from "../helpers"

let cwd: string

beforeEach(async () => {
  cwd = await mkdtemp(path.join(tmpdir(), "aid-tailwind-"))
})

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true })
})

function stubHtml(classes: string): string {
  return `<div class="${classes}">x</div>`
}

describe("compileTailwind", () => {
  test("compiles bundled defaults when no user main.css exists", async () => {
    const ctx = makeCtx(cwd)
    const css = await compileTailwind(ctx, [stubHtml("bg-aid-bg text-aid-text")])
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
    const ctx = makeCtx(cwd, { theme: { dark_mode: "off" } })
    const css = await compileTailwind(ctx, [stubHtml("bg-aid-bg")])
    expect(css).not.toContain("oklch(42% 0 0)")
  })

  test("keeps dark tokens in source when dark_mode is manual", async () => {
    await Bun.write(
      path.join(cwd, "main.css"),
      `@import "tailwindcss";\n@theme {\n  --color-aid-bg: oklch(99% 0 0);\n}\n@media (prefers-color-scheme: dark) {\n  :root {\n    --color-test-marker: oklch(42% 0 0);\n  }\n}\n`,
    )
    const ctx = makeCtx(cwd, { theme: { dark_mode: "manual" } })
    const css = await compileTailwind(ctx, [stubHtml("bg-aid-bg")])
    expect(css).toContain("oklch(42% 0 0)")
  })

  test("auto-derives dark tokens from light @theme", async () => {
    const ctx = makeCtx(cwd, { theme: { dark_mode: "auto" } })
    const css = await compileTailwind(ctx, [stubHtml("bg-aid-bg")])
    expect(css).toContain("oklch(1% 0 0)")
  })

  test("user main.css replaces bundled when present", async () => {
    await Bun.write(
      path.join(cwd, "main.css"),
      `@import "tailwindcss";\n@theme {\n  --color-aid-custom: oklch(50% 0.2 10);\n}\n`,
    )
    const ctx = makeCtx(cwd)
    const css = await compileTailwind(ctx, [stubHtml("bg-aid-custom")])
    expect(css).toContain("--color-aid-custom")
    expect(css).toContain(".bg-aid-custom")
    expect(css).not.toContain("--color-aid-accent")
  })

  test("resolves user @import relative to the user main.css", async () => {
    const ctx = makeCtx(cwd)
    await Bun.write(
      path.join(cwd, "extra.css"),
      `@theme {\n  --color-aid-extra: oklch(50% 0.2 100);\n}\n`,
    )
    await Bun.write(path.join(cwd, "main.css"), `@import "tailwindcss";\n@import "./extra.css";\n`)
    const css = await compileTailwind(ctx, [stubHtml("bg-aid-extra")])
    expect(css).toContain("--color-aid-extra")
    expect(css).toContain(".bg-aid-extra")
  })

  test('inlines bundled theme when user main.css contains @import "aid/theme"', async () => {
    await Bun.write(path.join(cwd, "main.css"), `@import "tailwindcss";\n@import "aid/theme";\n`)
    const ctx = makeCtx(cwd)
    const css = await compileTailwind(ctx, [stubHtml("aid-body")])
    expect(css).toContain(".aid-body")
    expect(css).toContain("--color-aid-bg")
  })

  test("user @theme overrides bundled tokens when imported after", async () => {
    await Bun.write(
      path.join(cwd, "main.css"),
      `@import "tailwindcss";\n@import "aid/theme";\n@theme {\n  --color-aid-accent: oklch(50% 0.2 100);\n}\n`,
    )
    const ctx = makeCtx(cwd)
    const css = await compileTailwind(ctx, [stubHtml("aid-body")])
    expect(css).toContain("oklch(50% 0.2 100)")
  })

  test('user main.css without @import "aid/theme" gets no bundled content', async () => {
    await Bun.write(
      path.join(cwd, "main.css"),
      `@import "tailwindcss";\n@theme {\n  --color-aid-custom: oklch(40% 0.1 200);\n}\n`,
    )
    const ctx = makeCtx(cwd)
    const css = await compileTailwind(ctx, [stubHtml("aid-body")])
    expect(css).not.toMatch(/\.aid-body\s*\{/)
    expect(css).toContain("--color-aid-custom")
  })
})
