import path from "node:path"
import type { Diagnostic } from "../lint/diagnostics"
import type { CopyAsset } from "../renderers/markdown/colocated-assets"
import { isLexicallyInside } from "./internal/paths"
import { routePathFromStem, routeUrl } from "./router"
import type { AnchorRef, BuildContext, RenderedPage, Route } from "./types"

/** Diagnostic codes for references the build could not resolve. */
export type BrokenLinkCode = "link/missing" | "link/excluded" | "link/outside"

/** Outcome of resolving one author-written href against the route table. */
export type ResolvedLink =
  | { kind: "skip" }
  | { kind: "page"; href: string; routePath: string; fragment: string }
  | { kind: "asset"; href: string }
  | { kind: "broken"; code: BrokenLinkCode; reason: string }

/** Resolves a relative href found in one page. The pipeline builds one per route. */
export type ResolveLink = (href: string) => Promise<ResolvedLink>

/** Route lookups by absolute source path and by route path. */
export type RouteIndex = { bySource: Map<string, Route>; byPath: Map<string, Route> }

/** Index `routes` once per build so every link resolves without rescanning. */
export function indexRoutes(routes: Route[]): RouteIndex {
  return {
    bySource: new Map(routes.map((r) => [r.source, r])),
    byPath: new Map(routes.map((r) => [r.path, r])),
  }
}

const SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i
const CONTENT_EXTS = new Set([".md", ".html", ".proto"])

/**
 * Build the link resolver for `route`. Links to content sources become route
 * URLs under `base_path`, other files are copied next to the page like
 * colocated images, and anything that cannot resolve comes back as `broken`.
 * Absolute paths, protocol-relative URLs and scheme URLs are left alone.
 */
export function makeResolveLink(
  route: Route,
  ctx: BuildContext,
  index: RouteIndex,
  copyAsset: CopyAsset,
): ResolveLink {
  const base = ctx.config.base_path
  return async (href) => {
    if (href === "" || href.startsWith("/") || SCHEME_RE.test(href)) {
      return { kind: "skip" }
    }
    const { pathPart, query, fragment } = splitHref(href)
    if (pathPart === "") {
      return fragment !== "" && query === ""
        ? { kind: "page", href, routePath: route.path, fragment }
        : { kind: "skip" }
    }
    let decoded: string
    try {
      decoded = decodeURI(pathPart)
    } catch {
      return broken("link/missing", `malformed link "${href}"`)
    }
    const abs = path.resolve(path.dirname(route.source), decoded)
    if (abs !== ctx.contentDir && !isLexicallyInside(abs, ctx.contentDir)) {
      return broken(
        "link/outside",
        `link "${href}" points outside the content dir. Use an absolute URL for files outside it.`,
      )
    }
    const toPage = (target: Route): ResolvedLink => ({
      kind: "page",
      href: `${routeUrl(target.path, base)}${query}${hashOf(fragment)}`,
      routePath: target.path,
      fragment,
    })
    const bySource = index.bySource.get(abs)
    if (bySource) {
      return toPage(bySource)
    }
    const ext = path.extname(abs).toLowerCase()
    if (CONTENT_EXTS.has(ext)) {
      const rel = path.relative(ctx.contentDir, abs)
      return rel.split(path.sep).some((seg) => seg.startsWith("_")) && (await isFile(abs))
        ? broken("link/excluded", `link "${href}" targets a page excluded by its "_" prefix`)
        : broken("link/missing", `link "${href}" targets a page that does not exist`)
    }
    if (!(await isFile(abs))) {
      const byPath = index.byPath.get(routePathFromStem(path.relative(ctx.contentDir, abs)))
      return byPath
        ? toPage(byPath)
        : broken("link/missing", `link "${href}" targets a file that does not exist`)
    }
    const assetHref = await copyAsset(abs)
    return assetHref === null
      ? broken("link/missing", `link "${href}" targets a file that does not exist`)
      : { kind: "asset", href: `${assetHref}${query}${hashOf(fragment)}` }
  }
}

function broken(code: BrokenLinkCode, reason: string): ResolvedLink {
  return { kind: "broken", code, reason }
}

/** Split an href into its path, its `?query` (with the `?`), and its fragment (without the `#`). */
export function splitHref(href: string): { pathPart: string; query: string; fragment: string } {
  const hashAt = href.indexOf("#")
  const fragment = hashAt === -1 ? "" : href.slice(hashAt + 1)
  const beforeHash = hashAt === -1 ? href : href.slice(0, hashAt)
  const queryAt = beforeHash.indexOf("?")
  return {
    pathPart: queryAt === -1 ? beforeHash : beforeHash.slice(0, queryAt),
    query: queryAt === -1 ? "" : beforeHash.slice(queryAt),
    fragment,
  }
}

const hashOf = (fragment: string): string => (fragment === "" ? "" : `#${fragment}`)

function isFile(p: string): Promise<boolean> {
  return Bun.file(p).exists()
}

/**
 * Fragment links whose target page publishes its anchors but not this one.
 * Pages without `knownAnchorIds` (OpenAPI, proto) render their ids in the browser, so
 * links into them are not checked.
 */
export function checkAnchors(pages: RenderedPage[]): Diagnostic[] {
  const anchorsByRoute = new Map(
    pages.flatMap((p) =>
      p.knownAnchorIds ? [[p.route.path, new Set(p.knownAnchorIds)] as const] : [],
    ),
  )
  return pages.flatMap((page) =>
    (page.anchorRefs ?? []).flatMap((ref) => {
      const anchors = anchorsByRoute.get(ref.routePath)
      if (!anchors || isKnownAnchor(ref.fragment, anchors)) {
        return []
      }
      return [anchorDiagnostic(page.route.source, ref)]
    }),
  )
}

function isKnownAnchor(fragment: string, anchors: Set<string>): boolean {
  // Browsers scroll to the top for `#` and `#top` even without a matching id.
  if (fragment === "" || fragment === "top") {
    return true
  }
  try {
    return anchors.has(decodeURIComponent(fragment))
  } catch {
    return false
  }
}

function anchorDiagnostic(file: string, ref: AnchorRef): Diagnostic {
  return {
    file,
    line: ref.line,
    col: ref.col,
    severity: "error",
    code: "link/anchor",
    message: `link "${ref.href}" targets a heading or id that does not exist`,
  }
}

const location = (d: Diagnostic): string =>
  d.line === undefined ? d.file : `${d.file}:${d.line}:${d.col ?? 1}`

/**
 * Report every broken reference in one message, sorted by file and position.
 * Throws when any problem has error severity, unless `on_broken_links` is
 * `warn`, so one build run lists every problem instead of stopping at the
 * first. Warning-severity problems, such as an unresolved `$ref`, only print.
 */
export function reportBrokenLinks(problems: Diagnostic[], ctx: BuildContext): void {
  if (problems.length === 0) {
    return
  }
  const lines = problems
    .map((d) => ({ ...d, file: path.relative(ctx.cwd, d.file) }))
    .toSorted(
      (a, b) =>
        a.file.localeCompare(b.file) ||
        (a.line ?? 0) - (b.line ?? 0) ||
        (a.col ?? 0) - (b.col ?? 0),
    )
    .map((d) => `  ${location(d)}  ${d.code}  ${d.message}`)
  const warnings = problems.filter((d) => d.severity !== "error").length
  const warningNote = warnings === 0 ? "" : ` (${warnings} warning${warnings === 1 ? "" : "s"})`
  const message = `aid: ${problems.length} broken reference${problems.length === 1 ? "" : "s"}${warningNote}\n${lines.join("\n")}`
  if (ctx.config.on_broken_links === "warn" || problems.every((d) => d.severity !== "error")) {
    console.warn(message)
    return
  }
  throw new Error(message)
}
