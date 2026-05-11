import path from "node:path"
import rehypeAutolinkHeadings from "rehype-autolink-headings"
import rehypeSlug from "rehype-slug"
import rehypeStringify from "rehype-stringify"
import remarkFrontmatter from "remark-frontmatter"
import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import { unified } from "unified"
import type { Frontmatter, RenderedPage, Route, SearchTokens } from "../types"

/** Arguments for {@link renderMarkdown}: the route metadata and the absolute source-file path. */
export type RenderMarkdownArgs = { route: Route; sourcePath: string }

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/
const H1_RE = /^#\s+(.+)$/m
const HEADING_RE = /^#{1,6}\s+(.+)$/gm

/**
 * Parse a markdown file into a RenderedPage. Frontmatter (YAML) is extracted
 * for SEO metadata; GFM tables/strikethrough/etc are supported; headings get
 * stable slugged ids and self-anchor links. The returned `html` is the body
 * content only — Layout/PageMarkdown wrapping happens in the pipeline.
 */
export async function renderMarkdown(args: RenderMarkdownArgs): Promise<RenderedPage> {
  const source = await Bun.file(args.sourcePath).text()
  const frontmatter = extractFrontmatter(source)
  const body = stripFrontmatter(source)

  const file = await unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ["yaml"])
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, { behavior: "wrap" })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(source)

  const html = String(file)
  const title = resolveTitle(frontmatter, body, args.sourcePath)
  const headings = collectHeadings(body)
  const searchTokens: SearchTokens = {
    title,
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

function extractFrontmatter(source: string): Frontmatter | undefined {
  const match = source.match(FRONTMATTER_RE)
  if (!match) return undefined
  const parsed = Bun.YAML.parse(match[1] ?? "")
  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) return undefined
  return parsed as Frontmatter
}

function stripFrontmatter(source: string): string {
  return source.replace(FRONTMATTER_RE, "")
}

function resolveTitle(
  frontmatter: Frontmatter | undefined,
  body: string,
  sourcePath: string,
): string {
  const fmTitle = frontmatter?.title
  if (typeof fmTitle === "string" && fmTitle.length > 0) return fmTitle
  const h1 = body.match(H1_RE)
  if (h1?.[1]) return h1[1].trim()
  return path.basename(sourcePath, path.extname(sourcePath))
}

function collectHeadings(body: string): string[] {
  const out: string[] = []
  HEADING_RE.lastIndex = 0
  let m: RegExpExecArray | null = HEADING_RE.exec(body)
  while (m !== null) {
    if (m[1]) out.push(m[1].trim())
    m = HEADING_RE.exec(body)
  }
  return out
}
