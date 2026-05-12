import path from "node:path"
import MiniSearch from "minisearch"
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

/** Indexed text fields. Stored on each document and tokenized by MiniSearch. */
export const SEARCH_FIELDS = ["title", "headings", "body", "extras"] as const

/** Fields retained on each search hit. Drives result rendering and per-format weighting. */
export const SEARCH_STORE_FIELDS = ["type", "title", "url"] as const

/** Title/heading boosts applied at index build time. Per-format weights are applied at query time. */
export const SEARCH_FIELD_BOOST = { title: 3, headings: 2 } as const

/**
 * Build the cross-format MiniSearch index from rendered pages. Returns `null`
 * when `config.search.enabled === false` so the pipeline skips emission and
 * the Layout omits the SearchBox entirely. Proto pages are filtered out
 * defensively until a proto renderer exists.
 */
export function buildSearchIndex(
  ctx: BuildContext,
  pages: RenderedPage[],
): SearchIndexResult | null {
  if (!ctx.config.search.enabled) return null
  const ms = new MiniSearch({
    idField: "id",
    fields: [...SEARCH_FIELDS],
    storeFields: [...SEARCH_STORE_FIELDS],
    searchOptions: { boost: { ...SEARCH_FIELD_BOOST } },
  })
  const docs = pages
    .filter((p) => p.route.kind !== "proto" && p.route.kind !== "index")
    .map((p) => ({
      id: p.route.path,
      type: p.route.kind,
      title: p.searchTokens.title,
      url: urlFor(p.route.path, ctx.config.base_path),
      headings: p.searchTokens.headings.join(" "),
      body: p.searchTokens.body,
      extras: Object.values(p.searchTokens.extras).flat().join(" "),
    }))
  ms.addAll(docs)
  const source = `window.__AID_SEARCH__=${JSON.stringify(ms.toJSON())};`
  const hash = Bun.hash.xxHash64(source).toString(16).padStart(16, "0").slice(0, 8)
  const filename = `search-index.${hash}.js`
  const href = path.posix.join(ctx.config.base_path, filename)
  return { filename, href, source }
}

function urlFor(routePath: string, basePath: string): string {
  if (routePath === "/") return basePath
  return path.posix.join(basePath, routePath)
}
