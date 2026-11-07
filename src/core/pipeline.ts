import { realpath } from "node:fs/promises"
import path from "node:path"
import { render, renderDocument } from "../jsx-runtime"
import { renderHtml } from "../renderers/html"
import { renderJsonSchema } from "../renderers/jsonschema"
import { renderMarkdown } from "../renderers/markdown"
import type { CopyAsset } from "../renderers/markdown/colocated-assets"
import { renderOpenApi } from "../renderers/openapi"
import { renderProto } from "../renderers/proto"
import { Layout } from "../theme/components/Layout"
import { PageHtml } from "../theme/components/PageHtml"
import { PageMarkdown } from "../theme/components/PageMarkdown"
import { AssetRegistry } from "./assets"
import { isLexicallyInside } from "./internal/paths"
import {
  checkAnchors,
  indexRoutes,
  makeResolveLink,
  type RouteIndex,
  reportBrokenLinks,
} from "./links"
import { buildLlmsTxt } from "./llms-txt"
import { buildNav } from "./nav"
import { buildRoutes, exportPath } from "./router"
import { buildSearchIndex, type SearchIndexResult } from "./search-index"
import { copyStaticAssets } from "./static"
import { compileTailwind } from "./tailwind"
import type { BuildContext, NavNode, RenderedPage, Route } from "./types"
import { type BuildWebBundleResult, buildWebBundle, writeHashed } from "./web-bundle"

const STYLESHEET_PLACEHOLDER = "__AID_STYLESHEET_HREF__"

/** Hooks for callers that need more than the written output, such as `aid dev`. */
export type BuildOptions = {
  onStylesheetDependency?: (path: string) => void
}

/**
 * Build the whole site from `ctx` into `ctx.outputDir`. Throws when two outputs
 * target the same path, a colocated asset escapes `contentDir`, or a link or
 * image does not resolve (unless `on_broken_links` is `warn`). Every output is
 * written at the end, so a build that throws leaves `outputDir` as it was.
 */
export async function build(ctx: BuildContext, options: BuildOptions = {}): Promise<void> {
  const registry = new AssetRegistry()

  const [routes] = await Promise.all([buildRoutes(ctx), copyStaticAssets(ctx, registry)])
  const realContentDir = await realpath(ctx.contentDir)

  const index = indexRoutes(routes)
  const rendered = await Promise.all(
    routes.map((route) => dispatchRenderer(route, ctx, registry, index, realContentDir)),
  )

  const nav = await buildNav(ctx, rendered)

  reportBrokenLinks(
    [
      ...rendered.flatMap((p) => p.diagnostics ?? []),
      ...checkAnchors(rendered),
      ...nav.diagnostics,
    ],
    ctx,
  )

  const web = await buildWebBundle(ctx, registry, {
    mermaid: rendered.some((p) => p.hasMermaid),
    openapi: rendered.some((p) => p.hasOpenApi),
    proto: rendered.some((p) => p.hasProto),
  })

  const searchIndex = buildSearchIndex(ctx, rendered)

  const docs = rendered.map((page) => ({
    fsPath: outputPathForRoute(page.route, ctx),
    html: wrapInLayout(page, ctx, nav.tree, STYLESHEET_PLACEHOLDER, web, searchIndex),
  }))

  const sideExports = rendered.flatMap((page) =>
    page.exports.map((e) => ({
      fsPath: outputPathForExport(page.route, e.suffix, ctx),
      body: e.body,
      source: page.route.source,
    })),
  )

  const llmsTxt = await buildLlmsTxt(ctx, rendered, nav.tree)
  registry.write(path.join(ctx.outputDir, "llms.txt"), "<generated:llms.txt>", llmsTxt)
  if (searchIndex) {
    registry.write(
      path.join(ctx.outputDir, searchIndex.filename),
      "<generated:search-index>",
      searchIndex.source,
    )
  }

  const css = await compileTailwind(
    ctx,
    docs.map((d) => d.html),
    options.onStylesheetDependency,
  )
  const href = writeHashed(ctx, registry, "main", "css", css)

  for (const doc of docs) {
    registry.write(
      doc.fsPath,
      `<rendered:${doc.fsPath}>`,
      doc.html.replaceAll(STYLESHEET_PLACEHOLDER, href),
    )
  }
  for (const exp of sideExports) {
    registry.write(exp.fsPath, `<export:${exp.source}>`, exp.body)
  }
  await registry.flush()
}

async function dispatchRenderer(
  route: Route,
  ctx: BuildContext,
  registry: AssetRegistry,
  index: RouteIndex,
  realContentDir: string,
): Promise<RenderedPage> {
  const copyAsset = () => makeCopyAsset(route, ctx, registry, realContentDir)
  switch (route.kind) {
    case "markdown":
    case "html": {
      const copy = copyAsset()
      const args = {
        route,
        sourcePath: route.source,
        copyAsset: copy,
        resolveLink: makeResolveLink(route, ctx, index, copy),
      }
      return route.kind === "markdown" ? renderMarkdown(args) : renderHtml(args)
    }
    case "openapi":
      return renderOpenApi({ route, sourcePath: route.source })
    case "proto":
      return renderProto({ route, sourcePath: route.source, basePath: ctx.config.base_path })
    case "jsonschema":
      return renderJsonSchema({
        route,
        sourcePath: route.source,
        index,
        basePath: ctx.config.base_path,
        resolveLink: makeResolveLink(route, ctx, index, copyAsset()),
      })
    default:
      throw new Error(`renderer not implemented: ${route.kind}`)
  }
}

function makeCopyAsset(
  route: Route,
  ctx: BuildContext,
  registry: AssetRegistry,
  realContentDir: string,
): CopyAsset {
  const routeOutputDir = path.dirname(outputPathForRoute(route, ctx))
  const routeUrlDir = path.posix.join(ctx.config.base_path, route.path)
  const sourceDir = path.dirname(route.source)
  return async (absoluteSource) => {
    const realSource = await assertInsideContent(absoluteSource, route, ctx, realContentDir)
    if (realSource === null) {
      return null
    }
    const subpath = colocatedSubpath(sourceDir, absoluteSource)
    registry.write(path.join(routeOutputDir, ...subpath), absoluteSource, Bun.file(realSource))
    return path.posix.join(routeUrlDir, ...subpath)
  }
}

function colocatedSubpath(sourceDir: string, absoluteSource: string): string[] {
  const segments = path.relative(sourceDir, absoluteSource).split(path.sep)
  const firstKept = segments.findIndex((segment) => segment !== "..")
  return segments.slice(firstKept)
}

async function assertInsideContent(
  source: string,
  route: Route,
  ctx: BuildContext,
  realContentDir: string,
): Promise<string | null> {
  const realSource = await realpathOrNull(source)
  const inside =
    isLexicallyInside(source, ctx.contentDir) &&
    (realSource === null || isLexicallyInside(realSource, realContentDir))
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
  nav: NavNode[],
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
      nav,
      currentPath: page.route.path,
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
    case "jsonschema":
      return page.html
    case "html":
      return render(PageHtml({ bodyHtml: page.html }))
    case "markdown":
      return render(PageMarkdown({ bodyHtml: page.html }))
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
