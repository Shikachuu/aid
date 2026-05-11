import type { Element as HastElement, Root as HastRoot } from "hast"
import { SKIP, visit } from "unist-util-visit"

const LANGUAGE_CLASS_PREFIX = "language-"
const MERMAID_LANGUAGE_CLASS = "language-mermaid"

/**
 * Rehype plugin that rewrites ```mermaid``` fenced code blocks into
 * `<pre class="mermaid">{raw text}</pre>`. The `<code>` child is dropped so
 * the client-side mermaid runtime can read `textContent` directly. Must run
 * **before** the shiki plugin — otherwise shiki sees the fence first and
 * highlights it as plain text.
 */
export function mermaidPlugin() {
  return (tree: HastRoot): void => {
    visit(tree, "element", (node, index, parent) => {
      if (node.tagName !== "pre" || !parent || index == null) return
      const code = node.children.find(isCodeElement)
      if (!code) return
      if (!hasMermaidLanguageClass(code)) return
      const text = extractText(code)
      parent.children[index] = {
        type: "element",
        tagName: "pre",
        properties: { className: ["mermaid"] },
        children: [{ type: "text", value: text }],
      }
      return SKIP
    })
  }
}

function isCodeElement(node: { type: string }): node is HastElement {
  return node.type === "element" && (node as HastElement).tagName === "code"
}

function hasMermaidLanguageClass(node: HastElement): boolean {
  const classes = node.properties?.className
  if (!Array.isArray(classes)) return false
  for (const cls of classes) {
    if (typeof cls !== "string") continue
    if (cls === MERMAID_LANGUAGE_CLASS) return true
    if (cls.startsWith(LANGUAGE_CLASS_PREFIX)) return false
  }
  return false
}

function extractText(node: HastElement): string {
  let out = ""
  for (const child of node.children) {
    if (child.type === "text") out += child.value
    else if (child.type === "element") out += extractText(child)
  }
  return out
}
