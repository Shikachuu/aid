import { findMatchingBrace } from "./internal/css-scan"

/** Result of deriving a dark palette from light `@theme` tokens. */
export type DerivedDarkPalette = {
  /** "@media (prefers-color-scheme: dark) { :root { ... } }" or "" if nothing was derivable. */
  darkBlock: string
  /** Human-readable diagnostics for color tokens that couldn't be derived. */
  warnings: string[]
}

const THEME_OPEN_RE = /@theme\s*\{/g
const DECL_RE = /(--[\w-]+)\s*:\s*([^;]+);/g
const OKLCH_RE = /^oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/

/**
 * Walk every `@theme { ... }` block in the input CSS and derive a dark
 * counterpart for every `--color-*` token whose value is `oklch(...)`.
 * Lightness is inverted (L becomes 100 - L); chroma, hue, and alpha pass through.
 * `--color-*` tokens whose value is not oklch are skipped with a warning.
 * Non-color tokens are silently ignored.
 *
 * Uses `:root` (not `@theme`) inside the @media wrapper because Tailwind 4
 * hoists `@theme` content out of @media wrappers at compile time.
 */
export function deriveDarkPalette(css: string): DerivedDarkPalette {
  const warnings: string[] = []
  const derivedDecls: string[] = []

  THEME_OPEN_RE.lastIndex = 0
  while (true) {
    const match = THEME_OPEN_RE.exec(css)
    if (!match) {
      break
    }
    const bodyStart = match.index + match[0].length
    const bodyEnd = findMatchingBrace(css, bodyStart - 1)
    if (bodyEnd < 0) {
      break
    }
    const body = css.slice(bodyStart, bodyEnd)
    THEME_OPEN_RE.lastIndex = bodyEnd + 1

    for (const [, name, rawValue] of body.matchAll(DECL_RE)) {
      if (!name || !rawValue || !name.startsWith("--color-")) {
        continue
      }
      const inverted = invertOklchLightness(rawValue.trim())
      if (inverted === null) {
        warnings.push(
          `dark-mode auto-derivation skipped ${name}: only oklch() colours are supported. Use theme.dark_mode: "manual" or convert to oklch.`,
        )
        continue
      }
      derivedDecls.push(`${name}: ${inverted};`)
    }
  }

  if (derivedDecls.length === 0) {
    return { darkBlock: "", warnings }
  }

  const indented = derivedDecls.map((d) => `    ${d}`).join("\n")
  const darkBlock = `@media (prefers-color-scheme: dark) {\n  :root {\n${indented}\n  }\n}`
  return { darkBlock, warnings }
}

function invertOklchLightness(value: string): string | null {
  const m = OKLCH_RE.exec(value)
  if (!m) {
    return null
  }
  const lRaw = m[1] ?? ""
  const c = m[2] ?? ""
  const h = m[3] ?? ""
  const alpha = m[4]

  const lNum = lRaw.endsWith("%")
    ? Number.parseFloat(lRaw.slice(0, -1))
    : Number.parseFloat(lRaw) * 100
  if (!Number.isFinite(lNum)) {
    return null
  }
  const lOut = `${Math.round((100 - lNum) * 1e4) / 1e4}%`
  const alphaSuffix = alpha !== undefined ? ` / ${alpha}` : ""
  return `oklch(${lOut} ${c} ${h}${alphaSuffix})`
}
