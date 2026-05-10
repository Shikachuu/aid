import type { RenderedPage } from "../core/types"

/**
 * Build a MiniSearch-compatible JSON index from rendered pages and emit it as
 * a self-bootstrapping `search-index.js` that sets `window.__AID_SEARCH__`.
 *
 * Stub. Implementation lands once tokenize() returns real data.
 */
export function emitSearchIndex(_pages: RenderedPage[]): string {
  return "window.__AID_SEARCH__ = null;"
}
