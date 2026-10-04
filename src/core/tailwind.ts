import path from "node:path"
import bundledMainCss from "../theme/main.css" with { type: "text" }
import { deriveDarkPalette } from "./dark-mode"
import { findMatchingBrace } from "./internal/css-scan"
import { installLightningcssShim } from "./internal/lightningcss-native"
import type { BuildContext } from "./types"

const aidProjectRoot = path.join(import.meta.dir, "../..")
const bundledMainCssPath = path.join(aidProjectRoot, "src/theme/main.css")
const bundledTailwindcssEntry = Bun.resolveSync("tailwindcss/index.css", import.meta.dir)

/**
 * Run `@tailwindcss/node` against the resolved entry stylesheet, driving class
 * discovery via synthesised `@source` directives. The user's `config.stylesheet`
 * (default `main.css`) replaces the bundled default when present; otherwise the
 * bundled `src/theme/main.css` is used. The prelude points Tailwind at the
 * bundled theme components, the user templates directory (if configured), and
 * the rendered HTML passed in `htmlContents`, so utilities used in any of those
 * become candidates.
 * A custom CSS resolver intercepts the `tailwindcss` import so the compile works
 * without `tailwindcss` being installed in the user's project — required for the
 * compiled-binary distribution model. Honours `theme.dark_mode`: `"off"` strips the dark `@media` block,
 * `"manual"` passes through unchanged. When dark_mode is `"auto"`, light @theme
 * oklch tokens are inverted to produce the dark palette automatically. Users can
 * opt into the bundled aid theme (defaults, components, Scalar bridge) by writing
 * `@import "aid/theme";` in their main.css; the bundled content is inlined into
 * the source before compile.
 */
export async function compileTailwind(
  ctx: BuildContext,
  htmlContents: readonly string[],
): Promise<string> {
  // @tailwindcss/node minifies via lightningcss, whose native binding loader
  // (`require(\`lightningcss-${platform}\`)`) isn't followed by `bun build
  // --compile`. The shim must run BEFORE @tailwindcss/node is loaded — its
  // own top-level `import { transform } from "lightningcss"` triggers
  // lightningcss/node/index.js to resolve the binding at module-load time.
  // We dynamically import both Tailwind packages here so the shim's
  // `Module.prototype.require` hook is in place first.
  await installLightningcssShim()
  const { compile } = await import("@tailwindcss/node")
  const { Scanner } = await import("@tailwindcss/oxide")
  const entry = await resolveEntry(ctx)
  const sourceTargets = collectSourceTargets(ctx)
  const inlined = inlineAidImports(entry.css)
  const darkApplied = applyDarkModeFlag(inlined, ctx.config.theme.dark_mode)
  const source = buildSourcePrelude(sourceTargets) + darkApplied

  const compiled = await compile(source, {
    base: entry.base,
    from: entry.from,
    onDependency: () => {},
    customCssResolver: async (id) => {
      if (id === "tailwindcss") {
        return bundledTailwindcssEntry
      }
      if (id.startsWith("tailwindcss/")) {
        return Bun.resolveSync(id, import.meta.dir)
      }
      return undefined
    },
  })
  const scanner = new Scanner({ sources: compiled.sources })
  return compiled.build([
    ...scanner.scan(),
    ...scanner.scanFiles(htmlContents.map((content) => ({ content, extension: "html" }))),
  ])
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
  // Rendered HTML is passed to compileTailwind in memory via `htmlContents`;
  // we no longer @source-scan `dist/**/*.html`. That avoids a temp-write pass
  // and lets us emit each HTML file exactly once.
  const targets: SourceTarget[] = [{ base: aidProjectRoot, pattern: "src/theme/**/*.{tsx,ts}" }]
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
  // Tailwind's @source value is a glob string; normalise to POSIX separators so
  // a Windows host doesn't produce `C:\foo\bar` (backslashes are glob escapes).
  return p.replaceAll("\\", "/").replaceAll('"', '\\"')
}

const AID_THEME_IMPORT_RE = /@import\s+(?:url\(\s*)?["']aid\/theme["'](?:\s*\))?\s*;?/g

// Replace `@import "aid/theme";` directives in the user's CSS with the bundled
// theme content. The bundled CSS is embedded into the binary at build time, so
// this works without a filesystem dependency — important for the eventual
// `bun build --compile` distribution where bundled resources aren't real files
// on disk.
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
  PREFERS_DARK_RE.lastIndex = 0
  while (true) {
    const match = PREFERS_DARK_RE.exec(css)
    if (!match) {
      break
    }
    const blockStart = match.index
    const bodyStart = match.index + match[0].length
    const bodyEnd = findMatchingBrace(css, bodyStart - 1)
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
