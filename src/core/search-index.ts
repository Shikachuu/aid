import path from "node:path"
import MiniSearch from "minisearch"
import { SEARCH_OPTIONS } from "./search-options"
import type { BuildContext, RenderedPage } from "./types"

/** Result of {@link buildSearchIndex}. */
export type SearchIndexResult = {
  /** Hashed filename (no directory prefix), e.g. `search-index.a1b2c3d4.js`. */
  filename: string
  /** Public href joined against `config.base_path`, ready for the Layout. */
  href: string
  /** JS source bytes. Assigns `window.__AID_SEARCH__` to the serialized MiniSearch index. */
  source: string
}

/**
 * Build the cross-format MiniSearch index from rendered pages. Returns `null`
 * when `config.search.enabled === false` so the pipeline skips emission and
 * the Layout omits the SearchBox entirely.
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
      url:
        p.route.path === "/"
          ? ctx.config.base_path
          : path.posix.join(ctx.config.base_path, p.route.path),
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
