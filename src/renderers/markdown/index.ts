import path from "node:path"
import rehypeShiki from "@shikijs/rehype"
import type { ElementContent, Element as HastElement, Root as HastRoot } from "hast"
import rehypeAutolinkHeadings from "rehype-autolink-headings"
import rehypeSlug from "rehype-slug"
import rehypeStringify from "rehype-stringify"
import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import { unified } from "unified"
import { visit } from "unist-util-visit"
import type { RenderedPage, Route, SearchTokens } from "../../core/types"
import { extractFrontmatter, type Frontmatter } from "./frontmatter"
import { mermaidPlugin } from "./mermaid"
import { SHIKI_OPTIONS } from "./shiki"

/** Arguments for {@link renderMarkdown}: the route metadata and the absolute source-file path. */
export type RenderMarkdownArgs = { route: Route; sourcePath: string }

/**
 * Parse a markdown file into a RenderedPage. Frontmatter is YAML, validated by
 * a Zod schema; GFM is enabled; headings get slugged ids and an appended `#`
 * anchor link. The body's first H1 is the page heading — if absent, the
 * renderer prepends one using the frontmatter title or filename so the page
 * chrome is consistent. The returned `html` is body content only; Layout +
 * PageMarkdown wrapping happens in the pipeline.
 */
export async function renderMarkdown(args: RenderMarkdownArgs): Promise<RenderedPage> {
  const source = await Bun.file(args.sourcePath).text()
  const { frontmatter, body } = extractFrontmatter(source)
  const filenameTitle = path.basename(args.sourcePath, path.extname(args.sourcePath))

  const titleSink = { value: frontmatter?.title ?? filenameTitle }
  const headings: string[] = []

  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
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
    .process(body)

  const html = String(file)
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
    exports: [],
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
