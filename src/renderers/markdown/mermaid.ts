import type { Element as HastElement, Root as HastRoot } from "hast"
import { SKIP, visit } from "unist-util-visit"
import type { VFile } from "vfile"

const LANGUAGE_CLASS_PREFIX = "language-"
const MERMAID_LANGUAGE_CLASS = "language-mermaid"

/** Key set on the rendered file's `data` map when a page contains at least one mermaid diagram. */
export const HAS_MERMAID_FLAG = "aidHasMermaid"

/**
 * Rehype plugin that rewrites ```mermaid``` fenced code blocks into
 * `<pre class="mermaid">{raw text}</pre>`. The `<code>` child is dropped so
 * the client-side mermaid runtime can read `textContent` directly. Must run
 * **before** the shiki plugin — otherwise shiki sees the fence first and
 * highlights it as plain text. Also flags `file.data.aidHasMermaid = true`
 * when any block is rewritten, so the pipeline can decide whether to inject
 * the mermaid bundle script.
 */
export function mermaidPlugin() {
  return (tree: HastRoot, file: VFile): void => {
    let found = false
    visit(tree, "element", (node, index, parent) => {
      if (node.tagName !== "pre" || !parent || index == null) {
        return
      }
      const code = node.children.find(isCodeElement)
      if (!code) {
        return
      }
      if (!hasMermaidLanguageClass(code)) {
        return
      }
      const text = extractText(code)
      parent.children[index] = {
        type: "element",
        tagName: "pre",
        properties: { className: ["mermaid"] },
        children: [{ type: "text", value: text }],
      }
      found = true
      return SKIP
    })
    if (found) {
      file.data[HAS_MERMAID_FLAG] = true
    }
  }
}

function isCodeElement(node: { type: string }): node is HastElement {
  return node.type === "element" && (node as HastElement).tagName === "code"
}

function hasMermaidLanguageClass(node: HastElement): boolean {
  const classes = node.properties?.className
  if (!Array.isArray(classes)) {
    return false
  }
  for (const cls of classes) {
    if (typeof cls !== "string") {
      continue
    }
    if (cls === MERMAID_LANGUAGE_CLASS) {
      return true
    }
    if (cls.startsWith(LANGUAGE_CLASS_PREFIX)) {
      return false
    }
  }
  return false
}

function extractText(node: HastElement): string {
  let out = ""
  for (const child of node.children) {
    if (child.type === "text") {
      out += child.value
    } else if (child.type === "element") {
      out += extractText(child)
    }
  }
  return out
}
