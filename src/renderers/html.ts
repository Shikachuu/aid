import path from "node:path"
import type { Element as HastElement, Root as HastRoot, RootContent } from "hast"
import type { Root as MdastRoot } from "mdast"
import rehypeParse from "rehype-parse"
import rehypeRemark from "rehype-remark"
import rehypeStringify from "rehype-stringify"
import remarkGfm from "remark-gfm"
import remarkStringify from "remark-stringify"
import { unified } from "unified"
import { SKIP, visit } from "unist-util-visit"
import { VFile } from "vfile"
import type { ResolveLink } from "../core/links"
import type { AnchorRef, RenderedPage, Route, SearchTokens } from "../core/types"
import { linkRefsFromHast, rewriteLinks } from "./links"
import { type CopyAsset, colocatedAssetsPlugin } from "./markdown/colocated-assets"
import type { Frontmatter } from "./markdown/frontmatter"
import { isMermaidElement } from "./markdown/mermaid"
import { collectAnchors, hastText, headingTexts, vfileDiagnostics } from "./shared"

/** What the pipeline passes to {@link renderHtml}; without the callbacks the render has no side effects. */
type RenderHtmlArgs = {
  route: Route
  sourcePath: string
  copyAsset?: CopyAsset
  resolveLink?: ResolveLink
}

/**
 * Render a full HTML document as body content. Layout owns the document
 * chrome, so `<head>` is dropped and its `<title>` and `<meta name="description">`
 * move onto `route.frontmatter`. The `.md` export comes from the same
 * rewritten body tree, so colocated image hrefs match in both outputs. Throws
 * on body fragments.
 */
export async function renderHtml(args: RenderHtmlArgs): Promise<RenderedPage> {
  const source = await Bun.file(args.sourcePath).text()
  // rehype-parse fabricates missing <html> and <body> wrappers, so only the raw
  // source can tell a fragment from a full document.
  if (!HTML_TAG_RE.test(source) || !BODY_TAG_RE.test(source)) {
    throw new Error(
      `aid: HTML page ${args.sourcePath} must be a full HTML document with <html> and <body>. Body fragments are not supported in v0.1.`,
    )
  }
  const file = new VFile({ path: args.sourcePath, value: source })

  const fullTree = unified().use(rehypeParse, { fragment: false }).parse(file) as HastRoot
  const htmlEl = findChildElement(fullTree, "html")
  const headEl = htmlEl ? findChildElement(htmlEl, "head") : null
  const bodyEl = htmlEl ? findChildElement(htmlEl, "body") : null

  const frontmatter = extractHeadMetadata(headEl)
  const title = frontmatter.title ?? path.basename(args.sourcePath, path.extname(args.sourcePath))

  const bodyTree: HastRoot = { type: "root", children: (bodyEl?.children ?? []) as RootContent[] }

  if (args.copyAsset) {
    const rewrite = colocatedAssetsPlugin({
      sourceDir: path.dirname(args.sourcePath),
      copyAsset: args.copyAsset,
    })
    await rewrite(bodyTree, file)
  }

  const anchorRefs: AnchorRef[] = args.resolveLink
    ? await rewriteLinks(linkRefsFromHast(bodyTree), args.resolveLink, file)
    : []

  let hasMermaid = false
  visit(bodyTree, "element", (node: HastElement) => {
    hasMermaid ||= isMermaidElement(node)
  })

  const html = unified().use(rehypeStringify).stringify(bodyTree)
  const mdBody = await toMarkdown(bodyTree)

  const searchTokens: SearchTokens = {
    title,
    body: searchBodyText(bodyTree),
    headings: headingTexts(bodyTree),
    extras: {},
  }

  return {
    route: { ...args.route, frontmatter },
    html,
    searchTokens,
    exports: [
      {
        suffix: ".md",
        body: mdBody,
      },
    ],
    hasMermaid,
    hasOpenApi: false,
    hasProto: false,
    description: frontmatter.description,
    knownAnchorIds: collectAnchors(bodyTree),
    anchorRefs,
    diagnostics: vfileDiagnostics(file, args.sourcePath),
  }
}

/**
 * Markdown has no syntax for `<details>`, `<dl>`, merged cells, or line
 * breaks and lists inside a table cell, so those elements stay HTML in the
 * export instead of losing their structure.
 */
async function toMarkdown(tree: HastRoot): Promise<string> {
  const copy = structuredClone(tree)
  visit(copy, "element", (node: HastElement, index, parent) => {
    if (parent && index !== undefined && keepsHtml(node)) {
      parent.children[index] = {
        type: "raw",
        value: unified()
          .use(rehypeStringify)
          .stringify({ type: "root", children: [node] }),
      }
      return SKIP
    }
    return undefined
  })
  const processor = unified()
    .use(rehypeRemark, {
      nodeHandlers: {
        raw: (_state, node) => ({ type: "html", value: (node as { value: string }).value }),
      },
    })
    .use(remarkGfm)
    .use(remarkStringify)
  return processor.stringify((await processor.run(copy)) as MdastRoot)
}

const HTML_ONLY_TAGS = new Set(["details", "dl"])
const CELL_BREAKING_TAGS = new Set([
  "br",
  "p",
  "ul",
  "ol",
  "dl",
  "div",
  "table",
  "pre",
  "blockquote",
  "hr",
])

function keepsHtml(node: HastElement): boolean {
  if (HTML_ONLY_TAGS.has(node.tagName)) {
    return true
  }
  if (node.tagName !== "table") {
    return false
  }
  let complex = false
  visit(node, "element", (el: HastElement) => {
    complex ||=
      Number(el.properties.colSpan ?? 1) > 1 ||
      Number(el.properties.rowSpan ?? 1) > 1 ||
      (el !== node && CELL_BREAKING_TAGS.has(el.tagName))
  })
  return complex
}

const HTML_TAG_RE = /<html(\s|>)/i
const BODY_TAG_RE = /<body(\s|>)/i

function findChildElement(parent: HastElement | HastRoot, tagName: string): HastElement | null {
  for (const child of parent.children) {
    if (child.type === "element" && (child as HastElement).tagName === tagName) {
      return child as HastElement
    }
  }
  return null
}

function extractHeadMetadata(head: HastElement | null): Frontmatter {
  const out: Frontmatter = {}
  if (!head) {
    return out
  }
  for (const child of head.children) {
    if (child.type !== "element") {
      continue
    }
    if (child.tagName === "title") {
      const text = hastText(child).trim()
      if (text.length > 0) {
        out.title = text
      }
      continue
    }
    if (child.tagName === "meta") {
      const name = child.properties?.name
      const content = child.properties?.content
      if (name === "description" && typeof content === "string" && content.length > 0) {
        out.description = content
      }
    }
  }
  return out
}

function searchBodyText(tree: HastRoot): string {
  const parts: string[] = []
  visit(tree, (node) => {
    if (node.type === "element" && NON_TEXT_TAGS.has(node.tagName)) {
      return SKIP
    }
    if (node.type === "text") {
      parts.push(node.value)
    }
    return undefined
  })
  return parts.join(" ").replace(/\s+/g, " ").trim()
}

const NON_TEXT_TAGS = new Set(["script", "style", "template"])
