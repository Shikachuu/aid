import type { RehypeShikiOptions } from "@shikijs/rehype"
import type { BundledLanguage, BundledTheme } from "shiki"

/**
 * Default fenced-code languages compiled into the build-time highlighter.
 * Kept deliberately small — `shiki`'s grammar JSON adds up fast. Users can
 * grow the list later via a config knob.
 */
export const DEFAULT_LANGS: BundledLanguage[] = [
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

/** Default dual-theme pair — emits `--shiki-light` / `--shiki-dark` CSS variables. */
export const DEFAULT_THEMES: { light: BundledTheme; dark: BundledTheme } = {
  light: "github-light",
  dark: "github-dark",
}

/**
 * Options passed to `@shikijs/rehype` via `unified().use(rehypeShiki, SHIKI_OPTIONS)`.
 * Dual-theme mode emits inline `--shiki-light` / `--shiki-dark` variables on every
 * span; CSS under `prefers-color-scheme: dark` flips which variable wins, so dark
 * mode works without a re-highlight on the client.
 *
 * Unknown languages fall back to plaintext rather than throwing — a typo in a
 * fence info string should not fail the build.
 */
export const SHIKI_OPTIONS: RehypeShikiOptions = {
  themes: DEFAULT_THEMES,
  langs: DEFAULT_LANGS,
  defaultColor: false,
  fallbackLanguage: "text",
  addLanguageClass: true,
}
