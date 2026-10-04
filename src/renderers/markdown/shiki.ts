import type { RehypeShikiOptions } from "@shikijs/rehype"
import type { BundledLanguage, BundledTheme } from "shiki"

/** Each shiki grammar is a large JSON file, so the build-time highlighter loads only these. */
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

const DEFAULT_THEMES: { light: BundledTheme; dark: BundledTheme } = {
  light: "github-light",
  dark: "github-dark",
}

/**
 * Options for `@shikijs/rehype`. `defaultColor: "light-dark()"` inlines
 * `light-dark(<light>, <dark>)` on every span, so the page's `color-scheme`
 * picks the theme without extra CSS or a client-side re-highlight.
 *
 * Unknown languages fall back to plain text, so a typo in a fence info string
 * does not fail the build.
 */
export const SHIKI_OPTIONS: RehypeShikiOptions = {
  themes: DEFAULT_THEMES,
  langs: DEFAULT_LANGS,
  defaultColor: "light-dark()",
  fallbackLanguage: "text",
  addLanguageClass: true,
}
