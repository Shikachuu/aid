import type { Element as HastElement, Root as HastRoot } from "hast"
import type { Preset } from "unified"
import { SKIP, visit } from "unist-util-visit"
import type { VFile } from "vfile"
import { hastText, parseHtmlFragment } from "../shared"
import { highlightCode } from "./shiki"

/** `file.data` key the pipeline reads to decide whether the page loads the mermaid bundle. */
export const HAS_MERMAID_FLAG = "aidHasMermaid"

/** A `pre.mermaid` or `div.mermaid` element, which the mermaid runtime renders in the browser. */
export function isMermaidElement(node: HastElement): boolean {
  const classes = node.properties.className
  return (
    (node.tagName === "pre" || node.tagName === "div") &&
    Array.isArray(classes) &&
    classes.includes("mermaid")
  )
}

/**
 * Turns mermaid fences into `pre.mermaid` and sets {@link HAS_MERMAID_FLAG}
 * so the pipeline injects the mermaid bundle. Raw `pre.mermaid` or
 * `div.mermaid` HTML in the source sets the flag too.
 */
function mermaidPlugin() {
  return (tree: HastRoot, file: VFile): void => {
    let found = false
    visit(tree, (node, index, parent) => {
      if (node.type === "raw") {
        found ||= MERMAID_CLASS_RE.test(node.value) && hasMermaidElement(node.value)
        return
      }
      if (node.type !== "element" || node.tagName !== "pre" || !parent || index == null) {
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

/** Mermaid diagrams, then syntax highlighting for every other code block. */
export const codeBlocks: Preset = { plugins: [mermaidPlugin, highlightCode] }

const MERMAID_CLASS_RE = /mermaid/i

function hasMermaidElement(html: string): boolean {
  let found = false
  visit(parseHtmlFragment(html), "element", (node: HastElement) => {
    found ||= isMermaidElement(node)
  })
  return found
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
