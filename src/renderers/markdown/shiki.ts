import rehypeShiki, { type RehypeShikiOptions } from "@shikijs/rehype"
import type { Element as HastElement, Root as HastRoot } from "hast"
import type { BundledLanguage, BundledTheme } from "shiki"
import type { Preset } from "unified"
import { visit } from "unist-util-visit"
import { hastText } from "../shared"

const PRELOADED_LANGS: BundledLanguage[] = [
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

const THEMES: { light: BundledTheme; dark: BundledTheme } = {
  light: "github-light",
  dark: "github-dark",
}

/**
 * Code blocks longer than this many lines render as plain text. Shiki's time
 * grows with the line count, so a generated file pasted into a fence would
 * otherwise slow down every build.
 */
export const MAX_HIGHLIGHT_LINES = 2000

/**
 * `defaultColor: "light-dark()"` inlines `light-dark(<light>, <dark>)` on
 * every span, so the page's `color-scheme` picks the theme without extra CSS
 * or a client-side re-highlight.
 */
const SHIKI_OPTIONS: RehypeShikiOptions = {
  themes: THEMES,
  langs: PRELOADED_LANGS,
  defaultColor: "light-dark()",
  fallbackLanguage: "text",
  addLanguageClass: true,
}

/** Highlight fenced code with shiki, leaving blocks over {@link MAX_HIGHLIGHT_LINES} as plain text. */
export const highlightCode: Preset = {
  plugins: [skipLargeCodeBlocks, [rehypeShiki, SHIKI_OPTIONS]],
}

/** Shiki highlights only `<pre><code>` with a `language-*` class, so dropping the class skips a block. */
function skipLargeCodeBlocks() {
  return (tree: HastRoot): void => {
    visit(tree, "element", (node: HastElement) => {
      const code = node.tagName === "pre" ? node.children[0] : undefined
      if (code?.type !== "element" || code.tagName !== "code") {
        return
      }
      const classes = code.properties.className
      if (Array.isArray(classes) && hastText(code).split("\n").length > MAX_HIGHLIGHT_LINES) {
        const kept = classes.filter((c) => !String(c).startsWith("language-"))
        code.properties.className = kept.length > 0 ? kept : undefined
      }
    })
  }
}
