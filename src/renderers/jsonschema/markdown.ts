import type { Definition, Html, Image, Link, Root as MdastRoot } from "mdast"
import rehypeStringify from "rehype-stringify"
import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import { unified } from "unified"
import { visit } from "unist-util-visit"
import { VFile } from "vfile"
import type { ResolveLink } from "../../core/links"
import type { AnchorRef } from "../../core/types"
import { type LinkRef, linkRefsFromMdast, rewriteLinks } from "../links"
import { highlightCode } from "../markdown/shiki"

const parser = unified().use(remarkParse).use(remarkGfm).freeze()
const toHtml = unified().use(remarkRehype).use(highlightCode).use(rehypeStringify).freeze()

const SAFE_SCHEME_RE = /^(?:https?|mailto):/i
const SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i

/** HTML for one markdown fragment, plus what its links need for the build's link check. */
export type RenderedFragment = { html: string; anchorRefs: AnchorRef[]; file: VFile }

/**
 * Render a schema `description` (or a generated code fence) to HTML. Schema
 * files are not trusted to inject markup or scripts: raw HTML shows as escaped
 * text, so a placeholder such as `<host>` stays readable, and
 * a link or image URL with a scheme other than `http`, `https`, or `mailto`
 * becomes `#`. Relative links and images go through `resolveLink` when one is
 * given, so links rewrite to route URLs, images are copied next to the page,
 * and broken ones land on `file.messages`.
 */
export async function renderMarkdownFragment(
  markdown: string,
  resolveLink?: ResolveLink,
): Promise<RenderedFragment> {
  const file = new VFile({ value: markdown })
  const tree = parser.parse(file) as MdastRoot
  visit(tree, "html", (node: Html, index, parent) => {
    if (parent && index !== undefined) {
      parent.children[index] = { type: "text", value: node.value }
    }
  })
  visit(tree, ["link", "image", "definition"], (node) => {
    const target = node as Link | Image | Definition
    if (SCHEME_RE.test(target.url) && !SAFE_SCHEME_RE.test(target.url)) {
      target.url = "#"
    }
  })
  const anchorRefs = resolveLink
    ? await rewriteLinks([...linkRefsFromMdast(tree), ...imageRefs(tree)], resolveLink, file)
    : []
  const hast = await toHtml.run(tree, file)
  return { html: toHtml.stringify(hast, file), anchorRefs, file }
}

function imageRefs(tree: MdastRoot): LinkRef[] {
  const refs: LinkRef[] = []
  visit(tree, "image", (node: Image) => {
    refs.push({ href: node.url, place: node.position, set: (href) => (node.url = href) })
  })
  return refs
}

/** Markdown for `value` as a fenced `json` block, with a fence longer than any backtick run inside. */
export function jsonFence(value: unknown): string {
  const body = JSON.stringify(value, null, 2)
  const longest = Math.max(0, ...[...body.matchAll(/`+/g)].map((m) => m[0].length))
  const fence = "`".repeat(Math.max(3, longest + 1))
  return `${fence}json\n${body}\n${fence}`
}
