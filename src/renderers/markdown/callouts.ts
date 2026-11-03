import type { Element as HastElement, Root as HastRoot } from "hast"
import type { Blockquote, Root as MdastRoot, Paragraph } from "mdast"
import { visit } from "unist-util-visit"

const TITLES = {
  note: "Note",
  tip: "Tip",
  important: "Important",
  warning: "Warning",
  caution: "Caution",
} as const

type CalloutType = keyof typeof TITLES

const MARKER_LINE_RE = /^\[!(note|tip|important|warning|caution)\][ \t]*(?:\r?\n|$)/i
const RAW_MARKER_RE = /^\[!(note|tip|important|warning|caution)\]$/i

/**
 * Split a GFM alert marker (`> [!NOTE]` alone on the first line of a
 * blockquote) into a raw `html` node. remark-stringify escapes `[` in text but
 * writes `html` nodes verbatim, so the `.md` export keeps the marker, and
 * {@link rehypeCallouts} finds it again as a `raw` node.
 */
export function remarkCalloutMarkers() {
  return (tree: MdastRoot): void => {
    visit(tree, "blockquote", (node: Blockquote) => {
      const first = node.children[0]
      const text = first?.type === "paragraph" ? first.children[0] : undefined
      if (text?.type !== "text") {
        return
      }
      const match = text.value.match(MARKER_LINE_RE)
      if (!match) {
        return
      }
      const marker = `[!${(match[1] as string).toUpperCase()}]`
      const rest = text.value.slice(match[0].length)
      const paragraph = first as Paragraph
      const hasMore = rest !== "" || paragraph.children.length > 1
      paragraph.children.splice(
        0,
        1,
        { type: "html", value: marker },
        ...(hasMore ? [{ type: "text" as const, value: `\n${rest}` }] : []),
      )
    })
  }
}

/**
 * Turn blockquotes that start with an alert marker into
 * `div.aid-callout.aid-callout-<type>` with a `p.aid-callout-title` heading.
 * Unknown alert types stay plain blockquotes.
 */
export function rehypeCallouts() {
  return (tree: HastRoot): void => {
    visit(tree, "element", (node: HastElement) => {
      if (node.tagName !== "blockquote") {
        return
      }
      const paragraph = node.children.find((c): c is HastElement => c.type === "element")
      const raw = paragraph?.tagName === "p" ? paragraph.children[0] : undefined
      const match = raw?.type === "raw" ? raw.value.match(RAW_MARKER_RE) : null
      if (!paragraph || !match) {
        return
      }
      const type = (match[1] as string).toLowerCase() as CalloutType
      paragraph.children.shift()
      const next = paragraph.children[0]
      if (next?.type === "text") {
        next.value = next.value.replace(/^\r?\n/, "")
      }
      if (paragraph.children.every((c) => c.type === "text" && c.value.trim() === "")) {
        node.children.splice(node.children.indexOf(paragraph), 1)
      }
      node.tagName = "div"
      node.properties = { className: ["aid-callout", `aid-callout-${type}`] }
      node.children.unshift({
        type: "element",
        tagName: "p",
        properties: { className: ["aid-callout-title"] },
        children: [{ type: "text", value: TITLES[type] }],
      })
    })
  }
}
