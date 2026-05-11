import path from "node:path"
import { render, renderDocument } from "../jsx-runtime"
import { renderMarkdown } from "../renderers/markdown"
import type { CopyAsset } from "../renderers/markdown/colocated-assets"
import { renderOpenApi } from "../renderers/openapi"
import { Layout } from "../theme/components/Layout"
import { PageMarkdown } from "../theme/components/PageMarkdown"
import { AssetRegistry } from "./assets"
import { writeCss } from "./css-writer"
import { buildRoutes } from "./router"
import { copyStaticAssets } from "./static"
import { compileTailwind } from "./tailwind"
import type { BuildContext, RenderedPage, Route } from "./types"
import { buildWebBundle } from "./web-bundle"

const STYLESHEET_PLACEHOLDER = "__AID_STYLESHEET_HREF__"

/**
 * Top-level build orchestrator. Copies static assets, bundles the browser
 * runtime, renders every route in parallel, asks Tailwind to scan the
 * rendered HTML in memory, writes the hashed CSS, and writes each page HTML
 * exactly once with the final stylesheet href substituted in.
 */
export async function build(ctx: BuildContext): Promise<void> {
  const registry = new AssetRegistry()

  const [routes] = await Promise.all([buildRoutes(ctx), copyStaticAssets({ ctx, registry })])

  const rendered = await Promise.all(routes.map((route) => dispatchRenderer(route, ctx, registry)))

  const siteHasMermaid = rendered.some((p) => p.hasMermaid)
  const siteHasOpenApi = rendered.some((p) => p.hasOpenApi)
  const web = await buildWebBundle({
    ctx,
    includeMermaid: siteHasMermaid,
    includeOpenApi: siteHasOpenApi,
  })

  const docs = rendered.map((page) => ({
    fsPath: outputPathForRoute(page.route, ctx),
    html: wrapInLayout(page, ctx, STYLESHEET_PLACEHOLDER, web),
  }))

  // Side-channel `.md` exports — one per markdown page. The OpenAPI `.json`
  // export already lives in page.exports[] but writing it is out of scope here,
  // so the suffix filter keeps this strictly the markdown sidechain.
  const mdExports = rendered.flatMap((page) =>
    page.exports
      .filter((e) => e.suffix === ".md")
      .map((e) => ({
        fsPath: outputPathForExport(page.route, e.suffix, ctx),
        body: e.body,
        source: page.route.source,
      })),
  )

  const { css } = await compileTailwind({ ctx, htmlContents: docs.map((d) => d.html) })
  const { href } = await writeCss({ ctx, css })

  await Promise.all([
    ...docs.map(async (doc) => {
      registry.register(doc.fsPath, `<rendered:${doc.fsPath}>`)
      await Bun.write(doc.fsPath, doc.html.replaceAll(STYLESHEET_PLACEHOLDER, href))
    }),
    ...mdExports.map(async (exp) => {
      registry.register(exp.fsPath, `<export:${exp.source}>`)
      await Bun.write(exp.fsPath, exp.body)
    }),
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
    case "openapi":
      return renderOpenApi({ route, sourcePath: route.source })
    default:
      throw new Error(`renderer not implemented: ${route.kind}`)
  }
}

/**
 * Build a per-page `copyAsset` callback. The callback enforces three rules:
 * (1) the resolved source must live inside `ctx.contentDir` — a `..`-escape
 * throws so an untrusted contributor cannot exfiltrate arbitrary files via a
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
    if (!isInside(absoluteSource, ctx.contentDir)) {
      throw new Error(
        `aid: colocated asset "${absoluteSource}" referenced from ${route.source} escapes contentDir (${ctx.contentDir}). Use a top-level static/ asset or move the file under contentDir.`,
      )
    }
    const src = Bun.file(absoluteSource)
    if (!(await src.exists())) return null
    const filename = path.basename(absoluteSource)
    const destPath = path.join(routeOutputDir, filename)
    registry.register(destPath, absoluteSource)
    await Bun.write(destPath, src)
    return path.posix.join(routeUrlDir, filename)
  }
}

/** `true` iff `child` is lexically a descendant of `parent`. Symlink-blind. */
function isInside(child: string, parent: string): boolean {
  const rel = path.relative(parent, child)
  return rel.length > 0 && !rel.startsWith("..") && !path.isAbsolute(rel)
}

function wrapInLayout(
  page: RenderedPage,
  ctx: BuildContext,
  stylesheetHref: string,
  web: {
    baseHref: string
    mermaidHref: string | null
    openapiHref: string | null
    openapiCssHref: string | null
  },
): string {
  const fm = page.route.frontmatter
  const title =
    typeof fm?.title === "string" && fm.title.length > 0 ? fm.title : page.searchTokens.title
  const description = typeof fm?.description === "string" ? fm.description : undefined
  // The OpenAPI renderer already produces a fully-wrapped PageOpenAPI body;
  // markdown still needs the PageMarkdown chrome added at layout time.
  const pageHtml =
    page.route.kind === "openapi"
      ? page.html
      : render(PageMarkdown({ bodyHtml: page.html, machineUrl: "" }) as never)
  return renderDocument(
    Layout({
      config: ctx.config,
      title,
      description,
      nav: [],
      stylesheetHref,
      webBundleHref: web.baseHref,
      mermaidBundleHref: page.hasMermaid ? web.mermaidHref : null,
      openapiBundleHref: page.hasOpenApi ? web.openapiHref : null,
      openapiStylesheetHref: page.hasOpenApi ? web.openapiCssHref : null,
      bodyHtml: pageHtml,
    }) as never,
  )
}

/** Disk path for a route's rendered HTML, e.g. `/foo` → `<outputDir>/foo/index.html`. */
export function outputPathForRoute(route: Route, ctx: BuildContext): string {
  if (route.path === "/") return path.join(ctx.outputDir, "index.html")
  const segments = route.path.replace(/^\//, "").split("/")
  return path.join(ctx.outputDir, ...segments, "index.html")
}

/**
 * Disk path for a side-channel export at a given suffix. Sibling to the
 * route's folder rather than nested inside it, so the URL `/foo` + `.md` →
 * file `<outputDir>/foo.md`. Root `/` collapses to `<outputDir>/index<suffix>`.
 */
export function outputPathForExport(route: Route, suffix: string, ctx: BuildContext): string {
  if (route.path === "/") return path.join(ctx.outputDir, `index${suffix}`)
  const segments = route.path.replace(/^\//, "").split("/")
  const last = segments.pop()
  if (last === undefined) return path.join(ctx.outputDir, `index${suffix}`)
  return path.join(ctx.outputDir, ...segments, `${last}${suffix}`)
}
