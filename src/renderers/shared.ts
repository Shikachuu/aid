import type { ElementContent, Element as HastElement } from "hast"
import type { VFile } from "vfile"
import type { Diagnostic } from "../lint/diagnostics"

/** Concatenated text of a hast node and all its descendants, untrimmed. */
export function hastText(node: HastElement | ElementContent): string {
  if (node.type === "text") {
    return node.value
  }
  return node.type === "element" ? node.children.map(hastText).join("") : ""
}

/** Display label for a slug such as `getting-started`, used where a folder has no page title. */
export function titleCase(slug: string): string {
  return slug
    .split(/[-_]/)
    .filter((s) => s.length > 0)
    .map((s) => s[0]?.toUpperCase() + s.slice(1))
    .join(" ")
}

/** Copy of `buckets` without its empty lists, so search extras carry only real fields. */
export function nonEmpty(buckets: Record<string, string[]>): Record<string, string[]> {
  return Object.fromEntries(Object.entries(buckets).filter(([, list]) => list.length > 0))
}

/** First paragraph of `text` on one line, used as the llms.txt description of a page. */
export function firstParagraph(text: string | null | undefined): string | undefined {
  const para = text?.split(/\r?\n\s*\r?\n/, 1)[0]?.trim()
  return para ? para.replace(/\s+/g, " ") : undefined
}

const ANCHOR_RE = /\s(?:id|name)\s*=\s*["']?([^"'\s>]+)/g

/** Every `id` and `name` attribute value in rendered HTML, including raw HTML authors wrote. */
export function collectAnchors(html: string): string[] {
  return [...html.matchAll(ANCHOR_RE)].map((m) => m[1] as string)
}

/**
 * Turn the `aid` messages a renderer left on `file` into diagnostics for
 * `sourcePath`. `lineOffset` maps body positions back to the source when
 * frontmatter was stripped before parsing.
 */
export function vfileDiagnostics(file: VFile, sourcePath: string, lineOffset = 0): Diagnostic[] {
  return file.messages
    .filter((m) => m.source === "aid")
    .map((m) => ({
      file: sourcePath,
      line: m.line === undefined ? undefined : m.line + lineOffset,
      col: m.column,
      severity: "error",
      code: m.ruleId ?? "aid",
      message: m.reason,
    }))
}
