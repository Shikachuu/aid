import path from "node:path"
import rehypeShiki from "@shikijs/rehype"
import type { Element as HastElement, Root as HastRoot } from "hast"
import type { Root as MdastRoot } from "mdast"
import rehypeAutolinkHeadings from "rehype-autolink-headings"
import rehypeSlug from "rehype-slug"
import rehypeStringify from "rehype-stringify"
import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import remarkStringify from "remark-stringify"
import { unified } from "unified"
import { VFile } from "vfile"
import type { ResolveLink } from "../../core/links"
import type { AnchorRef, RenderedPage, Route, SearchTokens } from "../../core/types"
import { linkRefsFromMdast, rewriteLinks } from "../links"
import {
  collectAnchors,
  hastText,
  headingTexts,
  parseHtmlFragment,
  vfileDiagnostics,
} from "../shared"
import { rehypeCallouts, remarkCalloutMarkers } from "./callouts"
import type { CopyAsset } from "./colocated-assets"
import { colocatedAssetsMdastPlugin } from "./colocated-assets-mdast"
import { extractFrontmatter } from "./frontmatter"
import { HAS_MERMAID_FLAG, mermaidPlugin } from "./mermaid"
import { SHIKI_OPTIONS } from "./shiki"

/** Arguments for {@link renderMarkdown}. */
export type RenderMarkdownArgs = {
  route: Route
  /** Absolute path of the source `.md` file on disk. */
  sourcePath: string
  /**
   * Optional callback invoked once per relative markdown image (`![](...)`).
   * Raw `<img>` tags are not copied. The pipeline passes one that copies
   * assets into the route's output dir.
   */
  copyAsset?: CopyAsset
  resolveLink?: ResolveLink
}

/**
 * Parse a markdown file into a RenderedPage, with GFM enabled. Headings get
 * slug ids and an appended `#` anchor link. When the body does not start with
 * an H1, the renderer prepends one from the frontmatter title or the file
 * name. The returned `html` is body content only, and the pipeline wraps it in
 * Layout and PageMarkdown. The `.md` export drops the frontmatter and uses the
 * same rewritten image hrefs as the HTML.
 */
export async function renderMarkdown(args: RenderMarkdownArgs): Promise<RenderedPage> {
  const source = await Bun.file(args.sourcePath).text()
  const { frontmatter, body, bodyLine } = parseFrontmatter(source, args.sourcePath)
  const filenameTitle = path.basename(args.sourcePath, path.extname(args.sourcePath))

  const titleSink = { value: frontmatter?.title ?? filenameTitle }
  const headings: string[] = []

  const file = new VFile({ path: args.sourcePath, value: body })
  const anchorRefs: AnchorRef[] = []
  const mdast = await buildMdast(file, args, anchorRefs)

  const htmlProcessor = unified()
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeCallouts)
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
    anchors: collectAnchors(htmlTree as HastRoot),
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
  let processor = unified().use(remarkParse).use(remarkGfm).use(remarkCalloutMarkers)
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

type TitleSink = { value: string }

function resolveAndEnsureLeadingH1(opts: {
  frontmatterTitle: string | undefined
  filenameTitle: string
  sink: TitleSink
}) {
  return (tree: HastRoot): void => {
    const existing = leadingH1(tree)
    if (existing) {
      opts.sink.value = opts.frontmatterTitle ?? hastText(existing)
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
