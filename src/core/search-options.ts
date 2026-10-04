/**
 * MiniSearch options shared by the build-time index (`search-index.ts`) and the
 * browser loader (`src/web/search.ts`). Kept dependency-free so the browser
 * bundle can import it. Per-format weights are applied at query time.
 */
export const SEARCH_OPTIONS = {
  fields: ["title", "headings", "body", "extras"],
  storeFields: ["type", "title", "url"],
  searchOptions: { boost: { title: 3, headings: 2 } },
}
