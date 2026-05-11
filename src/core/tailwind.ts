import path from "node:path"
import { compile } from "@tailwindcss/node"
import { Scanner } from "@tailwindcss/oxide"
import bundledMainCss from "../theme/main.css" with { type: "text" }
import type { BuildContext } from "./types"

export type CompileTailwindArgs = {
  ctx: BuildContext
  /**
   * Class names that aren't statically discoverable (e.g. emitted by embedded
   * UIs at render time). Tailwind generates these unconditionally, regardless
   * of @source scan results.
   */
  safelist?: Iterable<string>
}

export type CompileTailwindResult = {
  /** Compiled CSS, ready to write to disk. */
  css: string
  /** Absolute paths reported by Tailwind during compile. Use these in dev for file-watch invalidation. */
  dependencies: string[]
}

const aidProjectRoot = path.join(import.meta.dir, "../..")
const bundledMainCssPath = path.join(aidProjectRoot, "src/theme/main.css")

/**
 * Run `@tailwindcss/node` against the resolved entry stylesheet, driving class
 * discovery via synthesised `@source` directives. The user's `config.stylesheet`
 * (default `main.css`) replaces the bundled default when present; otherwise the
 * bundled `src/theme/main.css` is used. The prelude points Tailwind at the
 * bundled theme components, the user templates directory (if configured), and
 * the rendered HTML output, so utilities used in any of those become candidates.
 * The optional `safelist` adds class names that aren't statically discoverable
 * (e.g. emitted by embedded UIs at render time). Honours `theme.dark_mode`:
 * `"off"` strips the dark `@media` block, `"manual"` and `"auto"` pass through.
 * Auto-derivation of dark tokens from light tokens is a follow-up PR.
 */
export async function compileTailwind(args: CompileTailwindArgs): Promise<CompileTailwindResult> {
  const { ctx, safelist } = args
  const entry = await resolveEntry(ctx)
  const sourceTargets = collectSourceTargets(ctx)
  const darkApplied = applyDarkModeFlag(entry.css, ctx.config.theme.dark_mode)
  const source = buildSourcePrelude(sourceTargets) + darkApplied

  const dependencies: string[] = []
  const compiled = await compile(source, {
    base: entry.base,
    from: entry.from,
    onDependency: (p) => {
      dependencies.push(p)
    },
  })
  const scanner = new Scanner({ sources: compiled.sources })
  const candidates = [...scanner.scan(), ...(safelist ?? [])]
  const css = compiled.build(candidates)
  return { css, dependencies }
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
      base: aidProjectRoot,
      from: userPath,
    }
  }
  return {
    css: bundledMainCss,
    base: aidProjectRoot,
    from: bundledMainCssPath,
  }
}

type SourceTarget = {
  base: string
  pattern: string
}

function collectSourceTargets(ctx: BuildContext): SourceTarget[] {
  const targets: SourceTarget[] = [
    { base: aidProjectRoot, pattern: "src/theme/components/**/*.{tsx,ts}" },
    { base: aidProjectRoot, pattern: "src/theme/**/*.{tsx,ts}" },
  ]
  const templatesDir = ctx.config.dir.templates
  if (templatesDir !== "") {
    targets.push({
      base: path.join(ctx.cwd, templatesDir),
      pattern: "**/*.{tsx,ts,html}",
    })
  }
  targets.push({ base: ctx.outputDir, pattern: "**/*.html" })
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

function applyDarkModeFlag(css: string, mode: "auto" | "manual" | "off"): string {
  if (mode !== "off") {
    // TODO(dark-mode-derivation): when mode === "auto", parse @theme light tokens
    // and inject a derived `@media (prefers-color-scheme: dark) @theme { ... }`
    // block (oklch lightness inversion) before compile. Until then, `auto` and
    // `manual` are equivalent — both pass through whatever the entry CSS ships.
    return css
  }
  return stripPrefersDarkBlocks(css)
}

const PREFERS_DARK_RE = /@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)\s*\{/g

function stripPrefersDarkBlocks(css: string): string {
  let out = ""
  let cursor = 0
  PREFERS_DARK_RE.lastIndex = 0
  while (true) {
    const match = PREFERS_DARK_RE.exec(css)
    if (!match) break
    const blockStart = match.index
    const bodyStart = match.index + match[0].length
    const bodyEnd = findMatchingBrace(css, bodyStart - 1)
    if (bodyEnd < 0) break
    out += css.slice(cursor, blockStart)
    cursor = bodyEnd + 1
    PREFERS_DARK_RE.lastIndex = cursor
  }
  out += css.slice(cursor)
  return out
}

function findMatchingBrace(css: string, openIdx: number): number {
  let depth = 0
  for (let i = openIdx; i < css.length; i++) {
    const c = css[i]
    if (c === "{") depth++
    else if (c === "}") {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}
