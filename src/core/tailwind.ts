import { realpath } from "node:fs/promises"
import path from "node:path"
import tailwindIndexCss from "tailwindcss/index.css" with { type: "file" }
import tailwindPreflightCss from "tailwindcss/preflight.css" with { type: "file" }
import tailwindThemeCss from "tailwindcss/theme.css" with { type: "file" }
import tailwindUtilitiesCss from "tailwindcss/utilities.css" with { type: "file" }
import bundledMainCss from "../theme/main.css" with { type: "text" }
import { aidThemeSources } from "../web/_bundled"
import { AidConfigSchema } from "./config"
import { deriveDarkPalette } from "./dark-mode"
import { blankStringsAndComments, findMatchingBrace } from "./internal/css-scan"
import { installLightningcssShim } from "./internal/lightningcss-native"
import type { BuildContext } from "./types"
import { AID_ROOT, hasSourceTree, requireEmbedded } from "./web-entries"

const bundledMainCssPath = path.join(AID_ROOT, "src/theme/main.css")

const DEFAULT_STYLESHEET = AidConfigSchema.shape.stylesheet.parse(undefined)

/**
 * Compile the site stylesheet: `config.stylesheet`, or the bundled theme when the
 * default `main.css` is missing. A missing custom `stylesheet` throws.
 * `onDependency` gets every file the stylesheet `@import`s, so `aid dev` can
 * watch the partials.
 */
export async function compileTailwind(
  ctx: BuildContext,
  htmlContents: readonly string[],
  onDependency: (path: string) => void = () => {},
): Promise<string> {
  // lightningcss resolves its native binding when it is first imported, and
  // `@tailwindcss/node` imports it at load time. Install the shim first, then
  // import Tailwind dynamically.
  await installLightningcssShim()
  const { compile } = await import("@tailwindcss/node")
  const { Scanner } = await import("@tailwindcss/oxide")
  const entry = await resolveEntry(ctx)
  const fromSource = await hasSourceTree()
  const sourceTargets = collectSourceTargets(ctx, fromSource)
  const inlined = inlineAidImports(entry.css)
  const darkApplied = applyDarkModeFlag(inlined, ctx.config.theme.dark_mode)
  const source = buildSourcePrelude(sourceTargets) + darkApplied

  const compiled = await compile(source, compileOptions(entry.base, entry.from, onDependency))
  const scanner = new Scanner({ sources: compiled.sources })
  const themeFiles = fromSource
    ? []
    : [{ content: requireEmbedded("theme sources", aidThemeSources), extension: "tsx" }]
  return compiled.build([
    ...scanner.scan(),
    ...scanner.scanFiles([
      ...themeFiles,
      ...htmlContents.map((content) => ({ content, extension: "html" })),
    ]),
  ])
}

/**
 * Compile `css` with aid's Tailwind copy and `aid/theme` import, with no class
 * candidates, and throw Tailwind's error when the stylesheet is invalid. It
 * skips the dark-mode pass and the theme `@source` prelude of `aid build`.
 * `onDependency` gets every imported stylesheet, so lint can place an `@apply`
 * error that Tailwind reports without a file.
 */
export async function validateTailwindStylesheet(
  css: string,
  from: string,
  onDependency?: (path: string) => void,
): Promise<void> {
  await installLightningcssShim()
  const { compile } = await import("@tailwindcss/node")
  const compiled = await compile(
    inlineAidImports(css),
    compileOptions(path.dirname(from), from, onDependency),
  )
  compiled.build([])
}

function compileOptions(
  base: string,
  from: string,
  onDependency: (path: string) => void = () => {},
) {
  return {
    base,
    from,
    onDependency,
    customCssResolver: async (id: string, importerDir: string) =>
      TAILWIND_FILES[id] ?? (await resolveRelativeCss(id, importerDir)),
  }
}

// Tailwind's own resolver caches a failed lookup for 4 s, so a partial created
// right after a failed `aid dev` build would still fail the next rebuild.
async function resolveRelativeCss(id: string, importerDir: string): Promise<string | undefined> {
  if (!id.startsWith("./") && !id.startsWith("../")) {
    return undefined
  }
  const target = path.resolve(importerDir, id)
  const directoryIndex = (await Bun.file(path.join(target, "package.json")).exists())
    ? []
    : [path.join(target, "index.css")]
  for (const candidate of [target, `${target}.css`, ...directoryIndex]) {
    if (await Bun.file(candidate).exists()) {
      return realpath(candidate)
    }
  }
  return undefined
}

/**
 * aid's own copy of Tailwind's stylesheets, keyed by every specifier its
 * package exports. File imports embed them in the compiled binary, where
 * nothing can be resolved from `node_modules`.
 */
const TAILWIND_FILES: Record<string, string | undefined> = {
  tailwindcss: tailwindIndexCss,
  "tailwindcss/index": tailwindIndexCss,
  "tailwindcss/index.css": tailwindIndexCss,
  "tailwindcss/preflight": tailwindPreflightCss,
  "tailwindcss/preflight.css": tailwindPreflightCss,
  "tailwindcss/theme": tailwindThemeCss,
  "tailwindcss/theme.css": tailwindThemeCss,
  "tailwindcss/utilities": tailwindUtilitiesCss,
  "tailwindcss/utilities.css": tailwindUtilitiesCss,
}

type ResolvedEntry = {
  css: string
  base: string
  from: string
}

async function resolveEntry(ctx: BuildContext): Promise<ResolvedEntry> {
  const userPath = path.resolve(ctx.cwd, ctx.config.stylesheet)
  const userFile = Bun.file(userPath)
  if (await userFile.exists()) {
    return {
      css: await userFile.text(),
      base: path.dirname(userPath),
      from: userPath,
    }
  }
  if (ctx.config.stylesheet !== DEFAULT_STYLESHEET) {
    throw new Error(
      `aid: stylesheet "${ctx.config.stylesheet}" not found at ${userPath}. Create it, or remove the stylesheet key to use the bundled theme.`,
    )
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

function collectSourceTargets(ctx: BuildContext, fromSource: boolean): SourceTarget[] {
  const targets: SourceTarget[] = fromSource
    ? [{ base: AID_ROOT, pattern: "src/theme/**/*.{tsx,ts}" }]
    : []
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
  return `${css}\n@layer ${DERIVED_DARK_LAYER} {\n${result.darkBlock}\n}`
}

const DERIVED_DARK_LAYER = "theme"

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
