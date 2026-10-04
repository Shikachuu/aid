import type { Element as HastElement, Root as HastRoot } from "hast"
import { SKIP, visit } from "unist-util-visit"
import type { VFile } from "vfile"
import { hastText } from "../shared"

/** Key set on the rendered file's `data` map when a page contains at least one mermaid diagram. */
export const HAS_MERMAID_FLAG = "aidHasMermaid"

/**
 * Rehype plugin that rewrites ```mermaid``` fenced code blocks into
 * `<pre class="mermaid">{raw text}</pre>`. It drops the `<code>` child so the
 * client-side mermaid runtime can read `textContent` directly. Must run before
 * the shiki plugin, or shiki highlights the fence as plain text first. Sets
 * {@link HAS_MERMAID_FLAG} on `file.data` when it rewrites any block, so the
 * pipeline knows to inject the mermaid bundle.
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
      if (fenceLanguage(code) !== "language-mermaid") {
        return
      }
      const text = hastText(code)
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

function fenceLanguage(node: HastElement): string | undefined {
  const classes = node.properties?.className
  if (!Array.isArray(classes)) {
    return undefined
  }
  const first = classes.find((cls) => typeof cls === "string" && cls.startsWith("language-"))
  return first === undefined ? undefined : String(first)
}
