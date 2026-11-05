import { realpath } from "node:fs/promises"
import path from "node:path"
import { sniffJsonSchema } from "../renderers/jsonschema/sniff"
import { sniffOpenApi } from "../renderers/openapi/sniff"
import { assertRealPathInside } from "./internal/paths"
import type { BuildContext, PageKind, Route } from "./types"

/**
 * Walk `ctx.contentDir` and produce a Route for every supported source file.
 * Segments starting with `_` are excluded (drafts, partials, includes).
 * `.md` is markdown, `.html` is html, and `.proto` is proto. `.yaml`/`.yml`/`.json`
 * are content-sniffed: they become OpenAPI routes if they carry a top-level
 * `openapi:`/`swagger:` key, JSON Schema routes if they carry a `json-schema.org`
 * `$schema` key, and are silently skipped otherwise. Symlinks are followed when
 * their real path stays inside the content dir; one that leaves it throws.
 */
export async function buildRoutes(ctx: BuildContext): Promise<Route[]> {
  const realContentDir = await realContentRoot(ctx.contentDir)
  const glob = new Bun.Glob("**/*.{md,html,yaml,yml,json,proto}")
  const byPath = new Map<string, Route>()
  for await (const relative of glob.scan({
    cwd: ctx.contentDir,
    onlyFiles: true,
    followSymlinks: true,
  })) {
    const segments = relative.split(path.sep)
    if (segments.some((seg) => seg.startsWith("_"))) {
      continue
    }
    const source = path.join(ctx.contentDir, relative)
    await assertRealPathInside(source, realContentDir, "dir.content", ctx.contentDir)
    const kind = await classify(source)
    if (kind === null) {
      continue
    }
    const routePath = toRoutePath(relative)
    const existing = byPath.get(routePath)
    if (existing) {
      throw new Error(
        `aid: route collision — both "${existing.source}" and "${source}" resolve to ${routePath}. Rename one (e.g. drop the index.md, or move the bare .md into a subdirectory), or prefix a file that should not be a page with "_".`,
      )
    }
    byPath.set(routePath, { source, path: routePath, kind })
  }
  const routes = [...byPath.values()]
  routes.sort((a, b) => (a.path < b.path ? -1 : 1))
  return routes
}

async function realContentRoot(contentDir: string): Promise<string> {
  try {
    return await realpath(contentDir)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`aid: dir.content ${contentDir} does not exist.`, { cause: err })
    }
    throw err
  }
}

/**
 * Path of a route's side-channel export, relative to the site root. It sits next
 * to the route folder, so `/foo` with `.md` gives `/foo.md`. The root route gives `/index<suffix>`.
 */
export function exportPath(route: Route, suffix: string): string {
  return `${route.path === "/" ? "/index" : route.path}${suffix}`
}

const KIND_BY_EXT: Record<string, PageKind> = {
  ".md": "markdown",
  ".html": "html",
  ".proto": "proto",
}

async function classify(source: string): Promise<PageKind | null> {
  const ext = path.extname(source).toLowerCase()
  if (ext === ".yaml" || ext === ".yml" || ext === ".json") {
    if (await sniffOpenApi(source)) {
      return "openapi"
    }
    return (await sniffJsonSchema(source)) ? "jsonschema" : null
  }
  return KIND_BY_EXT[ext] ?? null
}

function toRoutePath(relative: string): string {
  return routePathFromStem(relative.slice(0, relative.length - path.extname(relative).length))
}

/**
 * Route path for a content-relative source path without its extension. Shared
 * by the router and link resolution, so `guides/index` and `guides/` both map to `/guides`.
 */
export function routePathFromStem(stem: string): string {
  const posix = stem.split(path.sep).join("/").replace(/\/+$/, "")
  return `/${posix.replace(/(^|\/)index$/, "")}`
}

/** Public URL of a route. The one place that applies `base_path`, for nav, links and search. */
export function routeUrl(routePath: string, basePath: string): string {
  return routePath === "/" ? basePath : path.posix.join(basePath, routePath)
}
