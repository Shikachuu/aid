import path from "node:path"
import rehypeShiki from "@shikijs/rehype"
import type { ElementContent, Element as HastElement, Root as HastRoot } from "hast"
import type { Root as MdastRoot } from "mdast"
import rehypeAutolinkHeadings from "rehype-autolink-headings"
import rehypeSlug from "rehype-slug"
import rehypeStringify from "rehype-stringify"
import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import remarkStringify from "remark-stringify"
import { unified } from "unified"
import { visit } from "unist-util-visit"
import { VFile } from "vfile"
import type { RenderedPage, Route, SearchTokens } from "../../core/types"
import type { CopyAsset } from "./colocated-assets"
import { colocatedAssetsMdastPlugin } from "./colocated-assets-mdast"
import { extractFrontmatter, type Frontmatter } from "./frontmatter"
import { HAS_MERMAID_FLAG, mermaidPlugin } from "./mermaid"
import { SHIKI_OPTIONS } from "./shiki"

/** Arguments for {@link renderMarkdown}. */
export type RenderMarkdownArgs = {
  route: Route
  /** Absolute path of the source `.md` file on disk. */
  sourcePath: string
  /**
   * Optional callback invoked once per relative `<img src>` encountered. The
   * pipeline supplies one that copies assets into the route's output dir;
   * omit during unit tests for a pure render with no side effects.
   */
  copyAsset?: CopyAsset
}

/**
 * Parse a markdown file into a RenderedPage. Frontmatter is YAML, validated by
 * a Zod schema; GFM is enabled; headings get slugged ids and an appended `#`
 * anchor link. The body's first H1 is the page heading — if absent, the
 * renderer prepends one using the frontmatter title or filename so the page
 * chrome is consistent. Returned `html` is body content only; Layout +
 * PageMarkdown wrapping happens in the pipeline. The `.md` sidechain export
 * (frontmatter-stripped, with relative image URLs rewritten to the same public
 * hrefs the HTML uses) is appended to `exports`.
 */
export async function renderMarkdown(args: RenderMarkdownArgs): Promise<RenderedPage> {
  const source = await Bun.file(args.sourcePath).text()
  const { frontmatter, body } = extractFrontmatter(source)
  const filenameTitle = path.basename(args.sourcePath, path.extname(args.sourcePath))

  const titleSink = { value: frontmatter?.title ?? filenameTitle }
  const headings: string[] = []

  // Shared mdast: parse + GFM + (optional) image URL rewrite. Forking after
  // this point means HTML and .md outputs see the same public hrefs and the
  // copyAsset side effects fire exactly once.
  let mdastProcessor = unified().use(remarkParse).use(remarkGfm)
  if (args.copyAsset) {
    mdastProcessor = mdastProcessor.use(colocatedAssetsMdastPlugin, {
      sourceDir: path.dirname(args.sourcePath),
      copyAsset: args.copyAsset,
    })
  }

  const file = new VFile({ value: body })
  const mdast = (await mdastProcessor.run(mdastProcessor.parse(file), file)) as MdastRoot

  // HTML branch: preserves the existing plugin order so the rendered body
  // stays byte-equivalent with the pre-fork output.
  const htmlProcessor = unified()
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(resolveAndEnsureLeadingH1, {
      frontmatterTitle: frontmatter?.title,
      filenameTitle,
      sink: titleSink,
    })
    .use(rehypeSlug)
    .use(collectHeadings, { sink: headings })
    .use(rehypeAutolinkHeadings, {
      behavior: "append",
      properties: { className: ["aid-heading-link"], ariaHidden: "true", tabIndex: -1 },
      content: {
        type: "element",
        tagName: "span",
        properties: { className: ["aid-heading-anchor"], ariaHidden: "true" },
        children: [{ type: "text", value: "#" }],
      },
    })
    .use(mermaidPlugin)
    .use(rehypeShiki, SHIKI_OPTIONS)
    .use(rehypeStringify, { allowDangerousHtml: true })

  // Clone the mdast for the HTML branch — remark-rehype and friends mutate it
  // and the MD branch still needs the original.
  const htmlTree = await htmlProcessor.run(structuredClone(mdast), file)
  const html = htmlProcessor.stringify(htmlTree as HastRoot, file)

  // MD branch: serialize the rewritten mdast back to markdown. `remark-gfm`
  // is included so the stringifier knows how to emit table/strikethrough nodes
  // that `remark-gfm` introduces during parsing.
  const mdBody = unified().use(remarkGfm).use(remarkStringify).stringify(mdast)

  const searchTokens: SearchTokens = {
    title: titleSink.value,
    body,
    headings,
    extras: {},
  }

  return {
    route: { ...args.route, frontmatter },
    html,
    searchTokens,
    exports: [
      {
        suffix: ".md",
        contentType: "text/markdown; charset=utf-8",
        body: mdBody,
      },
    ],
    hasMermaid: file.data[HAS_MERMAID_FLAG] === true,
    hasOpenApi: false,
  }
}

export type { Frontmatter }

type TitleSink = { value: string }

function resolveAndEnsureLeadingH1(opts: {
  frontmatterTitle: string | undefined
  filenameTitle: string
  sink: TitleSink
}) {
  return (tree: HastRoot): void => {
    const firstEl = tree.children.find((c): c is HastElement => c.type === "element")
    if (firstEl && firstEl.tagName === "h1") {
      opts.sink.value = opts.frontmatterTitle ?? hastToString(firstEl)
      return
    }
    const title = opts.frontmatterTitle ?? opts.filenameTitle
    opts.sink.value = title
    const h1: HastElement = {
      type: "element",
      tagName: "h1",
      properties: {},
      children: [{ type: "text", value: title }],
    }
    tree.children.unshift(h1)
  }
}

function collectHeadings(opts: { sink: string[] }) {
  return (tree: HastRoot): void => {
    visit(tree, "element", (node) => {
      if (HEADING_TAGS.has(node.tagName)) {
        opts.sink.push(hastToString(node))
      }
    })
  }
}

const HEADING_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"])

function hastToString(node: HastElement | ElementContent): string {
  if (node.type === "text") return node.value
  if (node.type === "element") {
    let out = ""
    for (const child of node.children) out += hastToString(child)
    return out
  }
  return ""
}
