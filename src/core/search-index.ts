import path from "node:path"
import MiniSearch from "minisearch"
import { routeUrl } from "./router"
import { SEARCH_OPTIONS } from "./search-options"
import type { BuildContext, RenderedPage } from "./types"

/**
 * The search index as a script, `source`, that assigns the serialized MiniSearch
 * index to `window.__AID_SEARCH__`, so pages load it with a plain `<script>`.
 */
export type SearchIndexResult = {
  filename: string
  href: string
  source: string
}

/**
 * Build the cross-format MiniSearch index from rendered pages. Returns `null`
 * when search is disabled, so the pipeline writes no index and the Layout
 * renders no search box.
 */
export function buildSearchIndex(
  ctx: BuildContext,
  pages: RenderedPage[],
): SearchIndexResult | null {
  if (!ctx.config.search.enabled) {
    return null
  }
  const ms = new MiniSearch(SEARCH_OPTIONS)
  ms.addAll(
    pages.map((p) => ({
      id: p.route.path,
      type: p.route.kind,
      title: p.searchTokens.title,
      url: routeUrl(p.route.path, ctx.config.base_path),
      headings: p.searchTokens.headings.join(" "),
      body: p.searchTokens.body,
      extras: Object.values(p.searchTokens.extras).flat().join(" "),
    })),
  )
  const source = `window.__AID_SEARCH__=${JSON.stringify(ms.toJSON())};`
  const hash = Bun.hash.xxHash64(source).toString(16).padStart(16, "0").slice(0, 8)
  const filename = `search-index.${hash}.js`
  const href = path.posix.join(ctx.config.base_path, filename)
  return { filename, href, source }
}
