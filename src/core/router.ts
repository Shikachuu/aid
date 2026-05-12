import path from "node:path"
import { sniffOpenApi } from "../renderers/openapi/sniff"
import type { BuildContext, PageKind, Route } from "./types"

/**
 * Walk `ctx.contentDir` and produce a Route for every supported source file.
 * Segments starting with `_` are excluded (drafts, partials, includes).
 * `.md` files always become markdown routes; `.html` files always become HTML
 * routes; `.yaml` / `.yml` / `.json` files are content-sniffed and become
 * OpenAPI routes if they carry a top-level `openapi:` / `swagger:` key, and are
 * silently skipped otherwise (data files).
 */
export async function buildRoutes(ctx: BuildContext): Promise<Route[]> {
  // TODO(other-renderers): wire .proto renderer in a subsequent milestone.
  const glob = new Bun.Glob("**/*.{md,html,yaml,yml,json}")
  const byPath = new Map<string, Route>()
  for await (const relative of glob.scan({ cwd: ctx.contentDir, onlyFiles: true })) {
    const segments = relative.split(path.sep)
    if (segments.some((seg) => seg.startsWith("_"))) continue
    const source = path.join(ctx.contentDir, relative)
    const kind = await classify(source)
    if (kind === null) continue
    const routePath = toRoutePath(relative)
    const existing = byPath.get(routePath)
    if (existing) {
      throw new Error(
        `aid: route collision — both "${existing.source}" and "${source}" resolve to ${routePath}. Rename one (e.g. drop the index.md, or move the bare .md into a subdirectory).`,
      )
    }
    byPath.set(routePath, { source, path: routePath, kind })
  }
  const routes = [...byPath.values()]
  routes.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
  return routes
}

async function classify(source: string): Promise<PageKind | null> {
  const ext = path.extname(source).toLowerCase()
  if (ext === ".md") return "markdown"
  if (ext === ".html") return "html"
  if (ext === ".yaml" || ext === ".yml" || ext === ".json") {
    return (await sniffOpenApi(source)) ? "openapi" : null
  }
  return null
}

function toRoutePath(relative: string): string {
  const posix = relative.split(path.sep).join("/")
  const withoutExt = posix.slice(0, -path.extname(posix).length)
  const parts = withoutExt.split("/")
  const last = parts[parts.length - 1]
  if (last === "index") {
    const parent = parts.slice(0, -1).join("/")
    if (parent === "") return "/"
    return `/${parent}`
  }
  return `/${withoutExt}`
}
