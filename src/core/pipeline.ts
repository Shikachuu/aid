import path from "node:path"
import { render, renderDocument } from "../jsx-runtime"
import { Layout } from "../theme/components/Layout"
import { PageMarkdown } from "../theme/components/PageMarkdown"
import { writeCss } from "./css-writer"
import { renderMarkdown } from "./renderers/markdown"
import { buildRoutes } from "./router"
import { compileTailwind } from "./tailwind"
import type { BuildContext, RenderedPage, Route } from "./types"

const STYLESHEET_PLACEHOLDER = "__AID_STYLESHEET_HREF__"

/**
 * Top-level build orchestrator. Renders every route, writes initial HTML to
 * outputDir (with a placeholder stylesheet href so Tailwind can @source-scan
 * the rendered output), compiles Tailwind, writes the hashed CSS, then
 * substitutes the placeholder with the final href and re-writes the HTML.
 */
export async function build(ctx: BuildContext): Promise<void> {
  const routes = await buildRoutes(ctx)
  const rendered: RenderedPage[] = []
  for (const route of routes) {
    rendered.push(await dispatchRenderer(route))
  }

  const docs: { fsPath: string; html: string }[] = []
  for (const page of rendered) {
    const html = wrapInLayout(page, ctx, STYLESHEET_PLACEHOLDER)
    const fsPath = outputPathForRoute(page.route, ctx)
    await Bun.write(fsPath, html)
    docs.push({ fsPath, html })
  }

  const { css } = await compileTailwind({ ctx })
  const { href } = await writeCss({ ctx, css })

  for (const doc of docs) {
    await Bun.write(doc.fsPath, doc.html.replaceAll(STYLESHEET_PLACEHOLDER, href))
  }
}

async function dispatchRenderer(route: Route): Promise<RenderedPage> {
  switch (route.kind) {
    case "markdown":
      return renderMarkdown({ route, sourcePath: route.source })
    default:
      throw new Error(`renderer not implemented: ${route.kind}`)
  }
}

function wrapInLayout(page: RenderedPage, ctx: BuildContext, stylesheetHref: string): string {
  const fm = page.route.frontmatter
  const title =
    typeof fm?.title === "string" && fm.title.length > 0 ? fm.title : page.searchTokens.title
  const description = typeof fm?.description === "string" ? fm.description : undefined
  const pageHtml = render(PageMarkdown({ title, bodyHtml: page.html, machineUrl: "" }) as never)
  return renderDocument(
    Layout({
      config: ctx.config,
      title,
      description,
      nav: [],
      stylesheetHref,
      bodyHtml: pageHtml,
    }) as never,
  )
}

function outputPathForRoute(route: Route, ctx: BuildContext): string {
  if (route.path === "/") return path.join(ctx.outputDir, "index.html")
  const segments = route.path.replace(/^\//, "").split("/")
  return path.join(ctx.outputDir, ...segments, "index.html")
}
