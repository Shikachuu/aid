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

/** Copy of `buckets` without its empty lists, so search extras carry only real fields. */
export function nonEmpty(buckets: Record<string, string[]>): Record<string, string[]> {
  return Object.fromEntries(Object.entries(buckets).filter(([, list]) => list.length > 0))
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
