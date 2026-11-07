import { blankStringsAndComments, findMatchingBrace } from "./internal/css-scan"

/**
 * A dark palette derived from light `@theme` tokens. `darkBlock` is an
 * `@media (prefers-color-scheme: dark)` rule, or "" when no token was derivable.
 */
export type DerivedDarkPalette = {
  darkBlock: string
  warnings: string[]
}

const THEME_OPEN_RE = /@theme\b([^{};]*)\{/g
const DECL_RE = /(--[\w-]+)\s*:\s*([^;]+);/g
const OKLCH_RE =
  /^oklch\(\s*([\d.]+%?)\s+([\d.]+|none)\s+([\d.]+(?:deg)?|none)(?:\s*\/\s*([\d.]+%?))?\s*\)$/
const UNREACHABLE_THEME_OPTIONS = ["inline", "reference"]

/**
 * Walk every `@theme` block in the input CSS, with or without options such as
 * `static`, and derive a dark counterpart for every `--color-*` token whose
 * value is `oklch(...)`. Chroma, hue, and alpha pass through; only the
 * lightness changes. `--color-*` tokens whose value is not oklch are skipped
 * with a warning, and so are `@theme inline` and `@theme reference` blocks,
 * whose tokens utilities do not read through CSS variables. Non-color tokens
 * are ignored. `@theme` blocks in files the stylesheet `@import`s are not read.
 *
 * Uses `:root` (not `@theme`) inside the @media wrapper because Tailwind 4
 * drops `@theme` variables that no utility uses, and the dark values must
 * always be emitted.
 */
export function deriveDarkPalette(css: string): DerivedDarkPalette {
  const warnings: string[] = []
  const derivedDecls: string[] = []

  const code = blankStringsAndComments(css).code
  THEME_OPEN_RE.lastIndex = 0
  while (true) {
    const match = THEME_OPEN_RE.exec(code)
    if (!match) {
      break
    }
    const bodyStart = match.index + match[0].length
    const bodyEnd = findMatchingBrace(code, bodyStart - 1)
    if (bodyEnd < 0) {
      break
    }
    const body = code.slice(bodyStart, bodyEnd)
    THEME_OPEN_RE.lastIndex = bodyEnd + 1
    const options = (match[1] ?? "").trim()
    if (options.split(/\s+/).some((o) => UNREACHABLE_THEME_OPTIONS.includes(o))) {
      if (/--color-/.test(body)) {
        warnings.push(
          `dark-mode auto-derivation skipped an @theme ${options} block: a dark :root override cannot reach its colors. Use theme.dark_mode: "manual" or a plain @theme block.`,
        )
      }
      continue
    }

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
  const chroma = c === "none" ? 0 : Number.parseFloat(c)
  const lOut = `${Math.round(darkLightness(lNum, chroma) * 1e4) / 1e4}%`
  const alphaSuffix = alpha !== undefined ? ` / ${alpha}` : ""
  return `oklch(${lOut} ${c} ${h}${alphaSuffix})`
}

const NEUTRAL_MIN = 12
const NEUTRAL_MAX = 100
const ACCENT_CHROMA = 0.03
const ACCENT_MAX_LIGHTNESS = 80
const ACCENT_MIN = 70
const ACCENT_MAX = 85

function darkLightness(l: number, chroma: number): number {
  if (chroma >= ACCENT_CHROMA && l <= ACCENT_MAX_LIGHTNESS) {
    return Math.min(Math.max(100 - l, ACCENT_MIN), ACCENT_MAX)
  }
  return NEUTRAL_MIN + ((NEUTRAL_MAX - NEUTRAL_MIN) * (100 - l)) / 100
}
