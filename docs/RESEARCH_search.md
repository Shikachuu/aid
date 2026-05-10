# Research: Frontend-Only Search Library for aid

_Date: 2026-05-10 — May 2026_

## Problem Statement

aid needs a **cross-format search** feature that:

1. Runs entirely in the browser — no server.
2. Supports full-text BM25-style ranking (not substring).
3. Has typo tolerance (Levenshtein) — users will misspell "OpenAPI" as "openpai".
4. Loads a precomputed index emitted at compile time by the aid binary (Go or Rust).
5. Lets users configure **per-document-type** weights in `aid.yaml` (e.g., boost OpenAPI hits over markdown body text).
6. Scales to 100–5000+ pages with **no in-browser indexing pass**.

## Candidates Evaluated

| Library      | Bundle (gz) | Typo tolerance              | Per-format weight         | Build-time index emit       | Last release      | Verdict                              |
| ------------ | ----------- | --------------------------- | ------------------------- | --------------------------- | ----------------- | ------------------------------------ |
| **MiniSearch** | **~5.8KB** | **Levenshtein, query-time** | **Yes via `boostDocument`** | **JSON format documented + stable** | 2024–25 active   | **WINNER**                           |
| Pagefind     | ~100KB total | No (prefix fallback only) | No                        | Native Rust crate, binary chunks | Apr 2026     | Runner-up — drops typo tolerance     |
| Orama        | ~22KB core  | Levenshtein                 | Hacky (custom sorter)     | Yes (plugin)                | Dec 2025          | Bigger + worse per-doc weighting     |
| FlexSearch   | 4.5–16KB    | **Phonetic only**           | Awkward                   | Multi-chunk export          | 2024–25           | "openpai → openapi" misses (phonetic)|
| Fuse.js      | ~4KB        | Bitap fuzzy                 | No                        | No                          | Apr 2026          | Not real full-text; ~800ms@10k items |
| Lunr.js      | ~9KB        | `~1` operator               | No                        | Yes                         | 2020 (dead)       | Skip                                 |
| Stork        | ~30KB WASM  | Limited                     | No                        | Yes (binary)                | Jan 2023 (dead)   | Skip — sunset                        |
| TinySearch   | ~49KB WASM  | **No**                      | No                        | Embedded                    | Sep 2025          | Set membership only, no ranking      |
| Elasticlunr  | ~12KB       | Limited                     | No                        | Yes                         | 2016 (dead)       | Skip                                 |

## Why MiniSearch Wins

1. **Per-document-type weighting is a one-liner.** The `boostDocument(id, term, storedFields) => number` query-time callback has access to stored fields:

   ```js
   ms.search('openpai', {
     fuzzy: 0.2,
     prefix: true,
     boostDocument: (id, term, fields) => yamlWeights[fields.type] ?? 1.0,
   });
   ```

   No competitor offers this cleanly.

2. **Index format is documented and stable.** The MiniSearch CHANGELOG explicitly states the JSON format was stabilized "to facilitate tools that create a serialized index in other languages." A Go or Rust port of the emitter is a few-hundred-LoC, one-time investment.

3. **True Levenshtein typo tolerance.** `fuzzy: 0.2` allows up to 20% of term length as edit distance. Catches "openpai → openapi" (transposition), "petsore → PetStore", etc.

4. **Smallest real full-text engine** at ~5.8KB gzipped, MIT, native TypeScript, actively maintained.

## Chosen Architecture: Option A — Build-Time Index Emission, Reuse MiniSearch Runtime

The aid binary emits MiniSearch's documented JSON index format **directly from Go/Rust**, with no embedded JavaScript runtime. The browser loads via `MiniSearch.loadJSON(...)` and is query-ready immediately — no `addAll` pass, no spinner, no indexing latency regardless of site size.

### Build pipeline (pure Go/Rust)

```
aid build
  └─ walks content tree
  └─ tokenizes each file according to its format:
       markdown   → headings + body text
       html       → visible text
       OpenAPI    → operationId, summary, description, schema/param names
       proto      → message names, field names, RPC names, comments
  └─ constructs an inverted index in pure Go/Rust
  └─ writes dist/search-index.js (a self-bootstrapping module that exposes
     window.__AID_SEARCH__ as a MiniSearch-format JSON literal)
  └─ ships dist/minisearch.min.js (~6KB gz) as the runtime
```

### Runtime pipeline (browser)

```
First focus of search box (lazy):
  └─ <script src="search-index.js">         // V8 bytecode-cached after first visit
  └─ <script src="minisearch.min.js">       // ~6KB gzipped
  └─ MiniSearch.loadJSON(window.__AID_SEARCH__, options)  // instant
  └─ ms.search(q, {
       fuzzy: 0.2,
       prefix: true,
       boostDocument: (id, term, fields) => weights[fields.type] ?? 1.0,
     })
```

### Why .js wrapper instead of .json
- V8 bytecode-caches `.js` after first load → zero parse cost on subsequent visits.
- Single network request, no `fetch().then(JSON.parse)` dance.
- Hashed filename for cache-busting on content changes.

### Why Option A over alternatives
- **vs. embed goja/boa in the binary**: aid binary stays pure Go/Rust. No 5MB JS-interpreter weight, no second runtime to keep current.
- **vs. ship raw doc JSON + index in browser**: no first-search indexing latency. For 5000-page sites, first-search delay drops from seconds to milliseconds.
- **vs. roll our own search engine**: reuses MiniSearch's tested BM25, Levenshtein, prefix matching, and `boostDocument` API. ~few-hundred-LoC emitter port instead of writing a search engine.
- **vs. Pagefind**: Pagefind has no Levenshtein typo tolerance. Hard fail for "openpai → openapi".

### Risk
If MiniSearch ships a breaking format change in a future major version, we update the emitter once. Format has been stable through 2024–25 majors; risk is low but non-zero. We pin a known-good MiniSearch runtime version per aid release.

## Open Questions

1. Should aid ship a minimal default search UI (input + result dropdown as a partial), or just emit the index + runtime and let users wire their own?
2. Stemming language: MiniSearch has no built-in language packs; do we ship a snowball stemmer for English-only v1, or pluggable per-language?
3. Cache-busting strategy for `search-index.js`: filename hash + immutable HTTP header is standard; confirm fits the static-host deploy model.

## Sources

- [MiniSearch repo](https://github.com/lucaong/minisearch) | [CHANGELOG](https://github.com/lucaong/minisearch/blob/master/CHANGELOG.md) | [SearchOptions](https://lucaong.github.io/minisearch/types/MiniSearch.SearchOptions.html) | [Bundlephobia](https://bundlephobia.com/package/minisearch)
- [Orama releases](https://github.com/oramasearch/orama/releases) | [persistence plugin](https://docs.orama.com/docs/orama-js/plugins/plugin-data-persistence)
- [FlexSearch repo](https://github.com/nextapps-de/flexsearch) | [fuzzy issue #118](https://github.com/nextapps-de/flexsearch/issues/118)
- [Pagefind site](https://pagefind.app/) | [weighting](https://pagefind.app/docs/weighting/) | [Rust crate](https://docs.rs/pagefind/latest/pagefind/index.html)
- [PkgPulse 2026: Fuse.js vs FlexSearch vs Orama](https://www.pkgpulse.com/blog/fusejs-vs-flexsearch-vs-orama-client-side-search-2026)
- [Stork sunset notice](https://github.com/jameslittle230/stork/discussions/360)
- [TinySearch releases](https://github.com/tinysearch/tinysearch/releases)
