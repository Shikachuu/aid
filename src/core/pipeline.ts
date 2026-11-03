import { realpath } from "node:fs/promises"
import path from "node:path"
import { render, renderDocument } from "../jsx-runtime"
import { renderHtml } from "../renderers/html"
import { renderMarkdown } from "../renderers/markdown"
import type { CopyAsset } from "../renderers/markdown/colocated-assets"
import { renderOpenApi } from "../renderers/openapi"
import { renderProto } from "../renderers/proto"
import { Layout } from "../theme/components/Layout"
import { PageHtml } from "../theme/components/PageHtml"
import { PageMarkdown } from "../theme/components/PageMarkdown"
import { AssetRegistry } from "./assets"
import {
  checkAnchors,
  indexRoutes,
  isLexicallyInside,
  makeResolveLink,
  type RouteIndex,
  reportBrokenLinks,
} from "./links"
import { buildLlmsTxt } from "./llms-txt"
import { buildRoutes, exportPath } from "./router"
import { buildSearchIndex, type SearchIndexResult } from "./search-index"
import { copyStaticAssets } from "./static"
import { compileTailwind } from "./tailwind"
import type { BuildContext, RenderedPage, Route } from "./types"
import { type BuildWebBundleResult, buildWebBundle, writeHashed } from "./web-bundle"

const STYLESHEET_PLACEHOLDER = "__AID_STYLESHEET_HREF__"

/**
 * Build the whole site from `ctx` into `ctx.outputDir`. Throws when two outputs
 * target the same path, a colocated asset escapes `contentDir`, or a link or
 * image does not resolve (unless `on_broken_links` is `warn`).
 */
export async function build(ctx: BuildContext): Promise<void> {
  const registry = new AssetRegistry()

  const [routes] = await Promise.all([buildRoutes(ctx), copyStaticAssets(ctx, registry)])

  const index = indexRoutes(routes)
  const rendered = await Promise.all(
    routes.map((route) => dispatchRenderer(route, ctx, registry, index)),
  )

  reportBrokenLinks(
    [...rendered.flatMap((p) => p.diagnostics ?? []), ...checkAnchors(rendered)],
    ctx,
  )

  const web = await buildWebBundle(ctx, {
    mermaid: rendered.some((p) => p.hasMermaid),
    openapi: rendered.some((p) => p.hasOpenApi),
    proto: rendered.some((p) => p.hasProto),
  })

  const searchIndex = buildSearchIndex(ctx, rendered)

  const docs = rendered.map((page) => ({
    fsPath: outputPathForRoute(page.route, ctx),
    html: wrapInLayout(page, ctx, STYLESHEET_PLACEHOLDER, web, searchIndex),
  }))

  const sideExports = rendered.flatMap((page) =>
    page.exports.map((e) => ({
      fsPath: outputPathForExport(page.route, e.suffix, ctx),
      body: e.body,
      source: page.route.source,
    })),
  )

  const llmsTxt = await buildLlmsTxt(ctx, rendered)
  const llmsTxtPath = path.join(ctx.outputDir, "llms.txt")
  registry.register(llmsTxtPath, "<generated:llms.txt>")

  const css = await compileTailwind(
    ctx,
    docs.map((d) => d.html),
  )
  const href = await writeHashed(ctx, "main", "css", css)

  const writes: Promise<unknown>[] = [Bun.write(llmsTxtPath, llmsTxt)]
  if (searchIndex) {
    const searchIndexPath = path.join(ctx.outputDir, searchIndex.filename)
    registry.register(searchIndexPath, "<generated:search-index>")
    writes.push(Bun.write(searchIndexPath, searchIndex.source))
  }

  await Promise.all([
    ...docs.map(async (doc) => {
      registry.register(doc.fsPath, `<rendered:${doc.fsPath}>`)
      await Bun.write(doc.fsPath, doc.html.replaceAll(STYLESHEET_PLACEHOLDER, href))
    }),
    ...sideExports.map(async (exp) => {
      registry.register(exp.fsPath, `<export:${exp.source}>`)
      await Bun.write(exp.fsPath, exp.body)
    }),
    ...writes,
  ])
}

async function dispatchRenderer(
  route: Route,
  ctx: BuildContext,
  registry: AssetRegistry,
  index: RouteIndex,
): Promise<RenderedPage> {
  switch (route.kind) {
    case "markdown":
    case "html": {
      const copyAsset = makeCopyAsset(route, ctx, registry)
      const args = {
        route,
        sourcePath: route.source,
        copyAsset,
        resolveLink: makeResolveLink(route, ctx, index, copyAsset),
      }
      return route.kind === "markdown" ? renderMarkdown(args) : renderHtml(args)
    }
    case "openapi":
      return renderOpenApi({ route, sourcePath: route.source })
    case "proto":
      return renderProto({ route, sourcePath: route.source })
    default:
      throw new Error(`renderer not implemented: ${route.kind}`)
  }
}

function makeCopyAsset(route: Route, ctx: BuildContext, registry: AssetRegistry): CopyAsset {
  const routeOutputDir = path.dirname(outputPathForRoute(route, ctx))
  const routeUrlDir = path.posix.join(ctx.config.base_path, route.path)
  return async (absoluteSource) => {
    const realSource = await assertInsideContent(absoluteSource, route, ctx)
    if (realSource === null) {
      return null
    }
    const filename = path.basename(absoluteSource)
    const destPath = path.join(routeOutputDir, filename)
    registry.register(destPath, absoluteSource)
    await Bun.write(destPath, Bun.file(realSource))
    return path.posix.join(routeUrlDir, filename)
  }
}

async function assertInsideContent(
  source: string,
  route: Route,
  ctx: BuildContext,
): Promise<string | null> {
  const realSource = await realpathOrNull(source)
  const inside =
    isLexicallyInside(source, ctx.contentDir) &&
    (realSource === null || isLexicallyInside(realSource, await realpath(ctx.contentDir)))
  if (!inside) {
    throw new Error(
      `aid: colocated asset "${source}" referenced from ${route.source} escapes contentDir (${ctx.contentDir}). Use a top-level static/ asset or move the file under contentDir.`,
    )
  }
  return realSource
}

async function realpathOrNull(p: string): Promise<string | null> {
  try {
    return await realpath(p)
  } catch {
    return null
  }
}

function wrapInLayout(
  page: RenderedPage,
  ctx: BuildContext,
  stylesheetHref: string,
  web: BuildWebBundleResult,
  searchIndex: SearchIndexResult | null,
): string {
  const description = page.route.frontmatter?.description
  const search = searchIndex
    ? {
        indexHref: searchIndex.href,
        typoTolerance: ctx.config.search.typo_tolerance,
        weights: ctx.config.search.weights,
      }
    : undefined
  return renderDocument(
    Layout({
      config: ctx.config,
      title: page.searchTokens.title,
      description,
      nav: [],
      stylesheetHref,
      webBundleHref: web.baseHref,
      mermaidBundleHref: page.hasMermaid ? web.mermaidHref : null,
      openapiBundleHref: page.hasOpenApi ? web.openapiHref : null,
      openapiStylesheetHref: page.hasOpenApi ? web.openapiCssHref : null,
      protoBundleHref: page.hasProto ? web.protoHref : null,
      protoStylesheetHref: page.hasProto ? web.protoCssHref : null,
      search,
      bodyHtml: renderPageBody(page),
    }),
  )
}

function renderPageBody(page: RenderedPage): string {
  switch (page.route.kind) {
    case "openapi":
    case "proto":
      return page.html
    case "html":
      return render(PageHtml({ bodyHtml: page.html, machineUrl: "" }))
    case "markdown":
      return render(PageMarkdown({ bodyHtml: page.html, machineUrl: "" }))
  }
}

/** Disk path for a route's rendered HTML, e.g. `/foo` gives `<outputDir>/foo/index.html`. */
export function outputPathForRoute(route: Route, ctx: BuildContext): string {
  return path.join(ctx.outputDir, route.path, "index.html")
}

/** Disk path for a side-channel export. See {@link exportPath} for the layout. */
export function outputPathForExport(route: Route, suffix: string, ctx: BuildContext): string {
  return path.join(ctx.outputDir, exportPath(route, suffix))
}
