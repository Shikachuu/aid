import path from "node:path"
import bundledMainCss from "../theme/main.css" with { type: "text" }
import { deriveDarkPalette } from "./dark-mode"
import { blankStringsAndComments, findMatchingBrace } from "./internal/css-scan"
import { installLightningcssShim } from "./internal/lightningcss-native"
import type { BuildContext } from "./types"
import { AID_ROOT } from "./web-entries"

const bundledMainCssPath = path.join(AID_ROOT, "src/theme/main.css")

/**
 * Compile the site stylesheet. Uses `config.stylesheet` when it exists and the
 * bundled `src/theme/main.css` otherwise. Tailwind scans the theme components,
 * the templates directory, and `htmlContents` for class candidates. `tailwindcss`
 * resolves to aid's own copy, so the user's project needs no install. An
 * `@import "aid/theme";` pulls in the bundled theme, and `theme.dark_mode` decides
 * whether the dark palette is derived, kept, or stripped.
 */
export async function compileTailwind(
  ctx: BuildContext,
  htmlContents: readonly string[],
): Promise<string> {
  // lightningcss resolves its native binding when it is first imported, and
  // `@tailwindcss/node` imports it at load time. Install the shim first, then
  // import Tailwind dynamically.
  await installLightningcssShim()
  const { compile } = await import("@tailwindcss/node")
  const { Scanner } = await import("@tailwindcss/oxide")
  const entry = await resolveEntry(ctx)
  const sourceTargets = collectSourceTargets(ctx)
  const inlined = inlineAidImports(entry.css)
  const darkApplied = applyDarkModeFlag(inlined, ctx.config.theme.dark_mode)
  const source = buildSourcePrelude(sourceTargets) + darkApplied

  const compiled = await compile(source, compileOptions(entry.base, entry.from))
  const scanner = new Scanner({ sources: compiled.sources })
  return compiled.build([
    ...scanner.scan(),
    ...scanner.scanFiles(htmlContents.map((content) => ({ content, extension: "html" }))),
  ])
}

/**
 * Compile `css` the way `aid build` does, with no class candidates, and throw
 * Tailwind's error when the stylesheet is invalid.
 */
export async function validateTailwindStylesheet(css: string, from: string): Promise<void> {
  await installLightningcssShim()
  const { compile } = await import("@tailwindcss/node")
  const compiled = await compile(inlineAidImports(css), compileOptions(path.dirname(from), from))
  compiled.build([])
}

function compileOptions(base: string, from: string) {
  return {
    base,
    from,
    onDependency: () => {},
    customCssResolver: async (id: string) => {
      if (id === "tailwindcss") {
        return Bun.resolveSync("tailwindcss/index.css", import.meta.dir)
      }
      if (id.startsWith("tailwindcss/")) {
        return Bun.resolveSync(id, import.meta.dir)
      }
      return undefined
    },
  }
}

type ResolvedEntry = {
  css: string
  base: string
  from: string
}

async function resolveEntry(ctx: BuildContext): Promise<ResolvedEntry> {
  const userPath = path.join(ctx.cwd, ctx.config.stylesheet)
  const userFile = Bun.file(userPath)
  if (await userFile.exists()) {
    return {
      css: await userFile.text(),
      base: path.dirname(userPath),
      from: userPath,
    }
  }
  return {
    css: bundledMainCss,
    base: path.dirname(bundledMainCssPath),
    from: bundledMainCssPath,
  }
}

type SourceTarget = {
  base: string
  pattern: string
}

function collectSourceTargets(ctx: BuildContext): SourceTarget[] {
  const targets: SourceTarget[] = [{ base: AID_ROOT, pattern: "src/theme/**/*.{tsx,ts}" }]
  if (ctx.templatesDir !== null) {
    targets.push({ base: ctx.templatesDir, pattern: "**/*.{tsx,ts,html}" })
  }
  return targets
}

function buildSourcePrelude(targets: SourceTarget[]): string {
  return targets
    .map((t) => `@source "${formatSourcePath(path.join(t.base, t.pattern))}";\n`)
    .join("")
}

function formatSourcePath(p: string): string {
  // Tailwind reads `@source` as a glob, where a backslash is an escape character.
  return p.replaceAll("\\", "/").replaceAll('"', '\\"')
}

const AID_THEME_IMPORT_RE = /@import\s+(?:url\(\s*)?["']aid\/theme["'](?:\s*\))?\s*;?/g

function inlineAidImports(css: string): string {
  return css.replaceAll(AID_THEME_IMPORT_RE, bundledMainCss)
}

function applyDarkModeFlag(css: string, mode: "auto" | "manual" | "off"): string {
  if (mode === "off") {
    return stripPrefersDarkBlocks(css)
  }
  if (mode === "manual") {
    return css
  }
  const result = deriveDarkPalette(css)
  for (const warning of result.warnings) {
    console.warn(warning)
  }
  if (result.darkBlock === "") {
    return css
  }
  return `${css}\n${result.darkBlock}`
}

const PREFERS_DARK_RE = /@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)\s*\{/g

function stripPrefersDarkBlocks(css: string): string {
  let out = ""
  let cursor = 0
  const code = blankStringsAndComments(css).code
  PREFERS_DARK_RE.lastIndex = 0
  while (true) {
    const match = PREFERS_DARK_RE.exec(code)
    if (!match) {
      break
    }
    const blockStart = match.index
    const bodyStart = match.index + match[0].length
    const bodyEnd = findMatchingBrace(code, bodyStart - 1)
    if (bodyEnd < 0) {
      break
    }
    out += css.slice(cursor, blockStart)
    cursor = bodyEnd + 1
    PREFERS_DARK_RE.lastIndex = cursor
  }
  out += css.slice(cursor)
  return out
}
