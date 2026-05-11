import path from "node:path"
import type { BuildContext, Route } from "./types"

/**
 * Walk `ctx.contentDir` and produce a Route for every supported source file.
 * Segments starting with `_` are excluded (drafts, partials, includes).
 * In M5 only `.md` files become routes; other kinds (.html, .yaml, .proto)
 * are intentionally skipped pending dedicated renderers.
 */
export async function buildRoutes(ctx: BuildContext): Promise<Route[]> {
  // TODO(other-renderers): wire .html/.yaml/.proto renderers in subsequent milestones.
  const glob = new Bun.Glob("**/*.md")
  const routes: Route[] = []
  for await (const relative of glob.scan({ cwd: ctx.contentDir, onlyFiles: true })) {
    const segments = relative.split(path.sep)
    if (segments.some((seg) => seg.startsWith("_"))) continue
    const routePath = toRoutePath(relative)
    routes.push({
      source: path.join(ctx.contentDir, relative),
      path: routePath,
      kind: "markdown",
    })
  }
  routes.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
  return routes
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
