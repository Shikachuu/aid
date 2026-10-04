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
import { buildLlmsTxt } from "./llms-txt"
import { buildRoutes } from "./router"
import { buildSearchIndex, type SearchIndexResult } from "./search-index"
import { copyStaticAssets } from "./static"
import { compileTailwind } from "./tailwind"
import type { BuildContext, RenderedPage, Route } from "./types"
import { type BuildWebBundleResult, buildWebBundle, writeHashed } from "./web-bundle"

const STYLESHEET_PLACEHOLDER = "__AID_STYLESHEET_HREF__"

/**
 * Top-level build orchestrator. Copies static assets, bundles the browser
 * runtime, renders every route in parallel, asks Tailwind to scan the
 * rendered HTML in memory, writes the hashed CSS, and writes each page HTML
 * exactly once with the final stylesheet href substituted in.
 */
export async function build(ctx: BuildContext): Promise<void> {
  const registry = new AssetRegistry()

  const [routes] = await Promise.all([buildRoutes(ctx), copyStaticAssets(ctx, registry)])

  const rendered = await Promise.all(routes.map((route) => dispatchRenderer(route, ctx, registry)))

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

  // Side-channel exports — sibling `.md` for markdown/HTML pages and `.json`
  // for OpenAPI/proto pages. Each renderer produces these on `page.exports[]`;
  // the pipeline just writes them next to the HTML at `<route>.<suffix>`.
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
): Promise<RenderedPage> {
  switch (route.kind) {
    case "markdown":
      return renderMarkdown({
        route,
        sourcePath: route.source,
        copyAsset: makeCopyAsset(route, ctx, registry),
      })
    case "html":
      return renderHtml({
        route,
        sourcePath: route.source,
        copyAsset: makeCopyAsset(route, ctx, registry),
      })
    case "openapi":
      return renderOpenApi({ route, sourcePath: route.source })
    case "proto":
      return renderProto({ route, sourcePath: route.source })
    default:
      throw new Error(`renderer not implemented: ${route.kind}`)
  }
}

/**
 * Build a per-page `copyAsset` callback. The callback enforces three rules:
 * (1) the resolved source must live inside `ctx.contentDir` — a `..`-escape
 * or a symlink pointing outside throws so an untrusted contributor cannot exfiltrate arbitrary files via a
 * colocated `<img>`; (2) the destination is registered with the shared
 * {@link AssetRegistry} before any copy, so a clash with a static asset or
 * another page surfaces as a hard error; (3) a non-existent source returns
 * `null`, which the rehype plugin surfaces as a non-fatal vfile message.
 */
function makeCopyAsset(route: Route, ctx: BuildContext, registry: AssetRegistry): CopyAsset {
  const routeOutputDir = path.dirname(outputPathForRoute(route, ctx))
  // The route's URL directory is the route path itself (every route resolves
  // to `<route>/index.html`), or just the base_path for the root route.
  const routeUrlDir =
    route.path === "/" ? ctx.config.base_path : path.posix.join(ctx.config.base_path, route.path)
  return async (absoluteSource) => {
    if (!(await isInside(absoluteSource, ctx.contentDir))) {
      throw new Error(
        `aid: colocated asset "${absoluteSource}" referenced from ${route.source} escapes contentDir (${ctx.contentDir}). Use a top-level static/ asset or move the file under contentDir.`,
      )
    }
    const src = Bun.file(absoluteSource)
    if (!(await src.exists())) {
      return null
    }
    const filename = path.basename(absoluteSource)
    const destPath = path.join(routeOutputDir, filename)
    registry.register(destPath, absoluteSource)
    await Bun.write(destPath, src)
    return path.posix.join(routeUrlDir, filename)
  }
}

/**
 * `true` iff `child` is a descendant of `parent`, both lexically and after
 * resolving symlinks. A `child` that does not exist is checked lexically only.
 */
async function isInside(child: string, parent: string): Promise<boolean> {
  const realChild = await realpathOrNull(child)
  return (
    isLexicallyInside(child, parent) &&
    (realChild === null || isLexicallyInside(realChild, await realpath(parent)))
  )
}

async function realpathOrNull(p: string): Promise<string | null> {
  try {
    return await realpath(p)
  } catch {
    return null
  }
}

function isLexicallyInside(child: string, parent: string): boolean {
  const rel = path.relative(parent, child)
  return rel !== "" && rel !== ".." && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel)
}

function wrapInLayout(
  page: RenderedPage,
  ctx: BuildContext,
  stylesheetHref: string,
  web: BuildWebBundleResult,
  searchIndex: SearchIndexResult | null,
): string {
  const description = page.route.frontmatter?.description
  // The OpenAPI and Proto renderers already produce fully-wrapped page bodies
  // (PageOpenAPI / PageProto). Markdown and HTML pages both share the
  // prose-style article chrome (toolbar + AI button slot) — same shell,
  // different variant class so themes can target them separately.
  const pageHtml =
    page.route.kind === "openapi" || page.route.kind === "proto"
      ? page.html
      : page.route.kind === "html"
        ? render(PageHtml({ bodyHtml: page.html, machineUrl: "" }))
        : render(PageMarkdown({ bodyHtml: page.html, machineUrl: "" }))
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
      bodyHtml: pageHtml,
    }),
  )
}

/** Disk path for a route's rendered HTML, e.g. `/foo` → `<outputDir>/foo/index.html`. */
export function outputPathForRoute(route: Route, ctx: BuildContext): string {
  return path.join(ctx.outputDir, route.path, "index.html")
}

/**
 * Disk path for a side-channel export at a given suffix. Sibling to the
 * route's folder rather than nested inside it, so the URL `/foo` + `.md` →
 * file `<outputDir>/foo.md`. Root `/` collapses to `<outputDir>/index<suffix>`.
 */
export function outputPathForExport(route: Route, suffix: string, ctx: BuildContext): string {
  return path.join(ctx.outputDir, route.path === "/" ? "index" : route.path) + suffix
}
