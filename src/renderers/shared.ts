import type { ElementContent, Element as HastElement } from "hast"

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
