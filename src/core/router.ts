import path from "node:path"
import { sniffOpenApi } from "../renderers/openapi/sniff"
import type { BuildContext, PageKind, Route } from "./types"

/**
 * Walk `ctx.contentDir` and produce a Route for every supported source file.
 * Segments starting with `_` are excluded (drafts, partials, includes).
 * `.md` → markdown; `.html` → html; `.proto` → proto; `.yaml`/`.yml`/`.json`
 * are content-sniffed and become OpenAPI routes if they carry a top-level
 * `openapi:`/`swagger:` key, and are silently skipped otherwise.
 */
export async function buildRoutes(ctx: BuildContext): Promise<Route[]> {
  const glob = new Bun.Glob("**/*.{md,html,yaml,yml,json,proto}")
  const byPath = new Map<string, Route>()
  for await (const relative of glob.scan({ cwd: ctx.contentDir, onlyFiles: true })) {
    const segments = relative.split(path.sep)
    if (segments.some((seg) => seg.startsWith("_"))) {
      continue
    }
    const source = path.join(ctx.contentDir, relative)
    const kind = await classify(source)
    if (kind === null) {
      continue
    }
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
  // Route paths are unique after the collision check, so ties never occur.
  routes.sort((a, b) => (a.path < b.path ? -1 : 1))
  return routes
}

const KIND_BY_EXT: Record<string, PageKind> = {
  ".md": "markdown",
  ".html": "html",
  ".proto": "proto",
}

async function classify(source: string): Promise<PageKind | null> {
  const ext = path.extname(source).toLowerCase()
  if (ext === ".yaml" || ext === ".yml" || ext === ".json") {
    return (await sniffOpenApi(source)) ? "openapi" : null
  }
  return KIND_BY_EXT[ext] ?? null
}

function toRoutePath(relative: string): string {
  const withoutExt = relative.split(path.sep).join("/").slice(0, -path.extname(relative).length)
  return `/${withoutExt.replace(/(^|\/)index$/, "")}`
}
