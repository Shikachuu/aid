import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm } from "node:fs/promises"
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
  const outputDir = path.join(cwd, config.dir.output)
  await mkdir(outputDir, { recursive: true })
  const ctx: BuildContext = {
    config,
    cwd,
    contentDir: path.join(cwd, config.dir.content),
    outputDir,
    templatesDir: null,
  }
  return ctx
}

async function writeStub(ctx: BuildContext, classes: string): Promise<void> {
  await Bun.write(path.join(ctx.outputDir, "stub.html"), `<div class="${classes}">x</div>`)
}

describe("compileTailwind", () => {
  test("compiles bundled defaults when no user main.css exists", async () => {
    const ctx = await makeCtx()
    await writeStub(ctx, "bg-aid-bg text-aid-text")
    const { css } = await compileTailwind({ ctx })
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
    await writeStub(ctx, "bg-aid-bg")
    const { css } = await compileTailwind({ ctx })
    expect(css).not.toContain("oklch(42% 0 0)")
  })

  test("keeps dark tokens in source when dark_mode is manual", async () => {
    await Bun.write(
      path.join(cwd, "main.css"),
      `@import "tailwindcss";\n@theme {\n  --color-aid-bg: oklch(99% 0 0);\n}\n@media (prefers-color-scheme: dark) {\n  :root {\n    --color-test-marker: oklch(42% 0 0);\n  }\n}\n`,
    )
    const ctx = await makeCtx({ dark_mode: "manual" })
    await writeStub(ctx, "bg-aid-bg")
    const { css } = await compileTailwind({ ctx })
    expect(css).toContain("oklch(42% 0 0)")
  })

  test("auto-derives dark tokens from light @theme", async () => {
    const ctx = await makeCtx({ dark_mode: "auto" })
    await writeStub(ctx, "bg-aid-bg")
    const { css } = await compileTailwind({ ctx })
    expect(css).toContain("oklch(1% 0 0)")
  })

  test("user main.css replaces bundled when present", async () => {
    await Bun.write(
      path.join(cwd, "main.css"),
      `@import "tailwindcss";\n@theme {\n  --color-aid-custom: oklch(50% 0.2 10);\n}\n`,
    )
    const ctx = await makeCtx()
    await writeStub(ctx, "bg-aid-custom")
    const { css } = await compileTailwind({ ctx })
    expect(css).toContain("--color-aid-custom")
    expect(css).toContain(".bg-aid-custom")
    // Bundled-only token must not appear.
    expect(css).not.toContain("--color-aid-accent")
  })

  test("returns dependencies as string array", async () => {
    const ctx = await makeCtx()
    await writeStub(ctx, "bg-aid-bg")
    const { dependencies } = await compileTailwind({ ctx })
    expect(Array.isArray(dependencies)).toBe(true)
  })

  test("safelist forces class generation when no source mentions it", async () => {
    const ctx = await makeCtx()
    const { css } = await compileTailwind({ ctx, safelist: ["bg-aid-bg"] })
    expect(css).toContain(".bg-aid-bg")
  })

  test("discovers a Tailwind utility from a bundled component TSX", async () => {
    const ctx = await makeCtx()
    const { css } = await compileTailwind({ ctx })
    expect(css).toMatch(/\.block\s*\{[^}]*display:\s*block/)
  })

  test("resolves user @import relative to the user main.css", async () => {
    const ctx = await makeCtx()
    await Bun.write(
      path.join(cwd, "extra.css"),
      `@theme {\n  --color-aid-extra: oklch(50% 0.2 100);\n}\n`,
    )
    await Bun.write(path.join(cwd, "main.css"), `@import "tailwindcss";\n@import "./extra.css";\n`)
    await writeStub(ctx, "bg-aid-extra")
    const { css } = await compileTailwind({ ctx })
    expect(css).toContain("--color-aid-extra")
    expect(css).toContain(".bg-aid-extra")
  })
})
