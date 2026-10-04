import type { RehypeShikiOptions } from "@shikijs/rehype"
import type { BundledLanguage, BundledTheme } from "shiki"

/**
 * Default fenced-code languages compiled into the build-time highlighter.
 * Kept deliberately small — `shiki`'s grammar JSON adds up fast. Users can
 * grow the list later via a config knob.
 */
const DEFAULT_LANGS: BundledLanguage[] = [
  "ts",
  "tsx",
  "js",
  "jsx",
  "json",
  "json5",
  "yaml",
  "toml",
  "html",
  "css",
  "md",
  "mdx",
  "bash",
  "sh",
  "shell",
  "python",
  "go",
  "rust",
  "proto",
  "sql",
  "docker",
  "diff",
  "http",
]

/** Default dual-theme pair, rendered as `color: light-dark(<light>, <dark>)`. */
const DEFAULT_THEMES: { light: BundledTheme; dark: BundledTheme } = {
  light: "github-light",
  dark: "github-dark",
}

/**
 * Options passed to `@shikijs/rehype` via `unified().use(rehypeShiki, SHIKI_OPTIONS)`.
 * `defaultColor: "light-dark()"` inlines `light-dark(<light>, <dark>)` on every
 * span, so the page's `color-scheme` picks the theme without extra CSS or a
 * re-highlight on the client.
 *
 * Unknown languages fall back to plaintext rather than throwing — a typo in a
 * fence info string should not fail the build.
 */
export const SHIKI_OPTIONS: RehypeShikiOptions = {
  themes: DEFAULT_THEMES,
  langs: DEFAULT_LANGS,
  defaultColor: "light-dark()",
  fallbackLanguage: "text",
  addLanguageClass: true,
}
