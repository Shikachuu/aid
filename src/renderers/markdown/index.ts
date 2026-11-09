import path from "node:path"
import type { Element as HastElement, Root as HastRoot } from "hast"
import type { Html, Root as MdastRoot } from "mdast"
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
import type { ResolveLink } from "../../core/links"
import type { AnchorRef, RenderedPage, Route, SearchTokens } from "../../core/types"
import { linkRefsFromMdast, rewriteLinks } from "../links"
import {
  collectAnchors,
  hastText,
  headingTexts,
  isFootnoteLabel,
  parseHtmlFragment,
  vfileDiagnostics,
} from "../shared"
import { rehypeCallouts, remarkCalloutMarkers } from "./callouts"
import { type CopyAsset, isRelativeUrl } from "./colocated-assets"
import { colocatedAssetsMdastPlugin } from "./colocated-assets-mdast"
import { extractFrontmatter } from "./frontmatter"
import { codeBlocks, HAS_MERMAID_FLAG } from "./mermaid"

/** What the pipeline passes to {@link renderMarkdown}; without the callbacks the render has no side effects. */
type RenderMarkdownArgs = {
  route: Route
  sourcePath: string
  copyAsset?: CopyAsset
  resolveLink?: ResolveLink
}

/**
 * Render a GFM markdown file as body content. When the body does not start
 * with an H1, the renderer prepends one without an id, so it cannot take the
 * slug of a later heading with the same text. The `.md` export drops the
 * frontmatter and uses the same rewritten image hrefs as the HTML.
 */
export async function renderMarkdown(args: RenderMarkdownArgs): Promise<RenderedPage> {
  const source = await Bun.file(args.sourcePath).text()
  const { frontmatter, body, bodyLine } = parseFrontmatter(source, args.sourcePath)
  const filenameTitle = path.basename(args.sourcePath, path.extname(args.sourcePath))

  const titleSink: TitleSink = { value: frontmatter?.title ?? filenameTitle, insert: false }
  const headings: string[] = []

  const file = new VFile({ path: args.sourcePath, value: body })
  const anchorRefs: AnchorRef[] = []
  const mdast = await buildMdast(file, args, anchorRefs)

  const htmlProcessor = unified()
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeCallouts)
    .use(resolveTitle, {
      frontmatterTitle: frontmatter?.title,
      filenameTitle,
      sink: titleSink,
    })
    .use(rehypeSlug)
    .use(collectHeadings, { sink: headings })
    .use(rehypeAutolinkHeadings, {
      behavior: "append",
      test: (node) => !isFootnoteLabel(node),
      properties: { className: ["aid-heading-link"], ariaHidden: "true", tabIndex: -1 },
      content: {
        type: "element",
        tagName: "span",
        properties: { className: ["aid-heading-anchor"], ariaHidden: "true" },
        children: [{ type: "text", value: "#" }],
      },
    })
    .use(insertLeadingH1, { sink: titleSink })
    .use(codeBlocks)
    .use(rehypeStringify, { allowDangerousHtml: true })

  const htmlTree = await htmlProcessor.run(mdast, file)
  const html = htmlProcessor.stringify(htmlTree as HastRoot, file)

  // The stringifier needs `remark-gfm` to emit the table and strikethrough
  // nodes that parsing produced.
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
        body: mdBody,
      },
    ],
    hasMermaid: file.data[HAS_MERMAID_FLAG] === true,
    hasOpenApi: false,
    hasProto: false,
    description: frontmatter?.description,
    knownAnchorIds: collectAnchors(htmlTree as HastRoot),
    anchorRefs: anchorRefs.map((ref) => ({
      ...ref,
      line: ref.line === undefined ? undefined : ref.line + bodyLine - 1,
    })),
    diagnostics: vfileDiagnostics(file, args.sourcePath, bodyLine - 1),
  }
}

async function buildMdast(
  file: VFile,
  args: RenderMarkdownArgs,
  anchorRefs: AnchorRef[],
): Promise<MdastRoot> {
  let processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkCalloutMarkers)
    .use(warnRawHtmlRelativeUrls)
  if (args.copyAsset) {
    processor = processor.use(colocatedAssetsMdastPlugin, {
      sourceDir: path.dirname(args.sourcePath),
      copyAsset: args.copyAsset,
    })
  }
  const { resolveLink } = args
  if (resolveLink) {
    processor = processor.use(() => async (tree: MdastRoot, vfile: VFile) => {
      anchorRefs.push(...(await rewriteLinks(linkRefsFromMdast(tree), resolveLink, vfile)))
    })
  }
  return (await processor.run(processor.parse(file), file)) as MdastRoot
}

function parseFrontmatter(source: string, sourcePath: string) {
  try {
    return extractFrontmatter(source)
  } catch (err) {
    throw new Error(`aid: invalid frontmatter in ${sourcePath}: ${(err as Error).message}`)
  }
}

function warnRawHtmlRelativeUrls() {
  return (tree: MdastRoot, file: VFile): void => {
    visit(tree, "html", (node: Html) => {
      visit(parseHtmlFragment(node.value), "element", (el: HastElement) => {
        const url =
          el.tagName === "img"
            ? el.properties.src
            : el.tagName === "a"
              ? el.properties.href
              : undefined
        if (typeof url === "string" && isRelativeUrl(url)) {
          file.info(
            `relative URL "${url}" in raw HTML is not copied or rewritten; use markdown image or link syntax`,
            { place: node.position, ruleId: "html/relative-url", source: "aid" },
          )
        }
      })
    })
  }
}

type TitleSink = { value: string; insert: boolean }

function resolveTitle(opts: {
  frontmatterTitle: string | undefined
  filenameTitle: string
  sink: TitleSink
}) {
  return (tree: HastRoot): void => {
    const existing = leadingH1(tree)
    opts.sink.insert = existing === undefined
    opts.sink.value =
      opts.frontmatterTitle ??
      ((existing &&
        hastText(existing)
          .replace(/[ \t\n\r\f]+/g, " ")
          .trim()) ||
        opts.filenameTitle)
  }
}

function insertLeadingH1(opts: { sink: TitleSink }) {
  return (tree: HastRoot): void => {
    if (opts.sink.insert) {
      tree.children.unshift({
        type: "element",
        tagName: "h1",
        properties: {},
        children: [{ type: "text", value: opts.sink.value }],
      })
    }
  }
}

function leadingH1(tree: HastRoot): HastElement | undefined {
  for (const child of tree.children) {
    if (child.type === "element") {
      return child.tagName === "h1" ? child : undefined
    }
    if (child.type === "raw" && RAW_H1_RE.test(child.value)) {
      return parseHtmlFragment(child.value).children.find(
        (c): c is HastElement => c.type === "element" && c.tagName === "h1",
      )
    }
  }
  return undefined
}

const RAW_H1_RE = /^\s*<h1[\s>]/i

function collectHeadings(opts: { sink: string[] }) {
  return (tree: HastRoot): void => {
    opts.sink.push(...headingTexts(tree))
  }
}
