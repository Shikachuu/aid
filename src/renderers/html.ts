import path from "node:path"
import type { Element as HastElement, Root as HastRoot, RootContent } from "hast"
import type { Root as MdastRoot } from "mdast"
import rehypeParse from "rehype-parse"
import rehypeRemark from "rehype-remark"
import rehypeStringify from "rehype-stringify"
import remarkStringify from "remark-stringify"
import { unified } from "unified"
import { visit } from "unist-util-visit"
import { VFile } from "vfile"
import type { RenderedPage, Route, SearchTokens } from "../core/types"
import { type CopyAsset, colocatedAssetsPlugin } from "./markdown/colocated-assets"
import type { Frontmatter } from "./markdown/frontmatter"
import { hastText } from "./shared"

/** Arguments for {@link renderHtml}. */
export type RenderHtmlArgs = {
  route: Route
  /** Absolute path of the source `.html` file on disk. */
  sourcePath: string
  /**
   * Optional callback invoked once per relative `<img src>` encountered in the
   * body subtree. The pipeline supplies one that copies assets into the route's
   * output dir; omit during unit tests for a pure render with no side effects.
   */
  copyAsset?: CopyAsset
}

/**
 * Parse a full HTML document into a RenderedPage. Layout owns the document
 * chrome, so `<head>` is dropped. `<title>` and `<meta name="description">`
 * move onto `route.frontmatter`, so Layout, llms.txt and search treat HTML
 * pages like markdown pages. The returned `html` is the body content without
 * any `<html>`, `<head>` or `<body>` wrapper. The `.md` export comes from the
 * same rewritten body tree, so colocated image hrefs match in both outputs.
 *
 * Throws on body fragments: the source must contain `<html>` and `<body>`.
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
  if (!htmlEl || !bodyEl) {
    throw new Error(
      `aid: HTML page ${args.sourcePath} parsed without an <html>/<body> tree — this should not happen for a sniffed-valid document.`,
    )
  }

  const frontmatter = extractHeadMetadata(headEl)
  const title = frontmatter.title ?? path.basename(args.sourcePath, path.extname(args.sourcePath))

  const bodyTree: HastRoot = { type: "root", children: bodyEl.children as RootContent[] }

  if (args.copyAsset) {
    const rewrite = colocatedAssetsPlugin({
      sourceDir: path.dirname(args.sourcePath),
      copyAsset: args.copyAsset,
    })
    await rewrite(bodyTree, file)
  }

  let hasMermaid = false
  visit(bodyTree, "element", (node: HastElement) => {
    if ((node.tagName === "pre" || node.tagName === "div") && hasClass(node, "mermaid")) {
      hasMermaid = true
    }
  })

  const html = unified().use(rehypeStringify).stringify(bodyTree)
  const mdBody = await toMarkdown(bodyTree)

  const searchTokens: SearchTokens = {
    title,
    body: html,
    headings: [],
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
  }
}

async function toMarkdown(tree: HastRoot): Promise<string> {
  const processor = unified().use(rehypeRemark).use(remarkStringify)
  return processor.stringify((await processor.run(tree)) as MdastRoot)
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

function hasClass(node: HastElement, cls: string): boolean {
  return (node.properties?.className as string[] | undefined)?.includes(cls) ?? false
}
