import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { generated } from "../../scripts/gen-bunfig"
import { configArgs, renderBunfig } from "../../src/lint/bun"

const ROOT = join(import.meta.dir, "../..")

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "aid-bunfig-"))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe("renderBunfig", () => {
  test("writes no [fmt] section without format options", () => {
    const toml = renderBunfig({ lint: { rules: { "no-debugger": "error" } } })
    expect(toml).not.toContain("[fmt]")
    expect(toml).toContain('"no-debugger" = "error"')
    expect(toml.endsWith("\n")).toBe(true)
  })

  test("writes [fmt] with format options", () => {
    const toml = renderBunfig({ lint: { rules: {} }, fmt: { printWidth: 100, semi: false } })
    expect(toml).toContain("[fmt]\nprintWidth = 100\nsemi = false\n")
  })
})

describe("generated repo config", () => {
  const files = Object.fromEntries(generated().map((f) => [f.path, f.content]))

  test("owns bunfig.toml for lint and .prettierrc.json for format", () => {
    expect(Object.keys(files).sort()).toEqual([".prettierrc.json", "bunfig.toml"])
    expect(files["bunfig.toml"]).toContain("[lint.rules]")
    expect(files["bunfig.toml"]).not.toContain("[fmt]")
  })

  test("points the Tailwind plugin at stylesheets whose imports resolve", async () => {
    const prettier = JSON.parse(files[".prettierrc.json"] ?? "") as {
      plugins: string[]
      tailwindStylesheet: string
      overrides: { files: string; options: { tailwindStylesheet: string } }[]
    }
    expect(prettier.plugins).toEqual(["prettier-plugin-tailwindcss"])
    const sheets = [
      prettier.tailwindStylesheet,
      ...prettier.overrides.map((o) => o.options.tailwindStylesheet),
    ]
    for (const sheet of sheets) {
      const css = await Bun.file(join(ROOT, sheet)).text()
      const imports = [...css.matchAll(/@import\s+"([^"]+)"/g)].map((m) => m[1] ?? "")
      expect(imports.length).toBeGreaterThan(0)
      for (const specifier of imports) {
        expect(() => Bun.resolveSync(specifier, dirname(join(ROOT, sheet)))).not.toThrow()
      }
    }
  })

  test("matches the committed files", async () => {
    for (const [path, content] of Object.entries(files)) {
      expect(await Bun.file(join(ROOT, path)).text()).toBe(content)
    }
  })

  test("sorts aid's theme classes as known Tailwind classes", async () => {
    const file = join(ROOT, "src/theme/components/__sort-probe.tsx")
    const proc = Bun.spawn([process.execPath, "fmt", "--no-script", "--stdin-filepath", file], {
      cwd: ROOT,
      stdin: new Blob(['export const A = () => <div className="bg-aid-bg m-0 flex" />\n']),
      stdout: "pipe",
    })
    expect(await new Response(proc.stdout).text()).toContain('className="m-0 flex bg-aid-bg"')
  })
})

describe("configArgs with a lint-only bunfig", () => {
  test("uses the project's Prettier config for fmt instead of the bundled default", async () => {
    await Bun.write(join(dir, "bunfig.toml"), '[lint.rules]\n"no-console" = "error"\n')
    await Bun.write(join(dir, ".prettierrc.json"), "{}\n")
    expect(await configArgs(dir, "fmt")).toEqual([])
    expect(await configArgs(dir, "lint")).toEqual([`-c=${join(dir, "bunfig.toml")}`])
  })
})
