import type { RenderedPage, SearchTokens } from "../core/types"

/**
 * Per-format tokenizer. Pulls the right fields per kind:
 *   markdown → frontmatter title, headings (boosted), body text
 *   openapi  → operationId, summary, description, path, schema names
 *   proto    → message names, field names, RPC names, comments
 *   html     → <title>, h1–h6, visible text
 *
 * Stub.
 */
export function tokenize(_page: RenderedPage): SearchTokens {
  return { title: "", body: "", headings: [], extras: {} }
}
