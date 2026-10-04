# Research: frontend-only search library for aid

Status: historical research brief. The project chose Bun and TypeScript; see docs/BUILD.md for the current design.

_Date: 2026-05-10_

## Problem statement

aid needs a cross-format search feature that:

1. Runs in the browser with no server.
2. Supports full-text BM25-style ranking (not substring).
3. Has Levenshtein typo tolerance. Users will type "openpai" for "OpenAPI".
4. Loads a precomputed index that `aid build` writes.
5. Lets users configure per-document-type weights in `aid.yaml` (for example, to boost OpenAPI hits over markdown body text).
6. Scales to 100 to 5000+ pages without building the index in the browser.

## Candidates evaluated

| Library      | Bundle (gz) | Typo tolerance              | Per-format weight         | Build-time index emit       | Last release      | Verdict                              |
| ------------ | ----------- | --------------------------- | ------------------------- | --------------------------- | ----------------- | ------------------------------------ |
| MiniSearch   | ~5.8KB      | Levenshtein, query-time     | Yes via `boostDocument`   | JSON format documented + stable | 2024-25 active | Winner                              |
| Pagefind     | ~100KB total | No (prefix fallback only) | No                        | Native Rust crate, binary chunks | Apr 2026     | Runner-up, no typo tolerance         |
| Orama        | ~22KB core  | Levenshtein                 | Needs a custom sorter     | Yes (plugin)                | Dec 2025          | Bigger + worse per-doc weighting     |
| FlexSearch   | 4.5-16KB    | Phonetic only               | Awkward                   | Multi-chunk export          | 2024-25           | Misses "openpai" for "openapi" (phonetic) |
| Fuse.js      | ~4KB        | Bitap fuzzy                 | No                        | No                          | Apr 2026          | Not real full-text; ~800 ms at 10k items |
| Lunr.js      | ~9KB        | `~1` operator               | No                        | Yes                         | 2020 (dead)       | Skip                                 |
| Stork        | ~30KB WASM  | Limited                     | No                        | Yes (binary)                | Jan 2023 (dead)   | Skip, discontinued                   |
| TinySearch   | ~49KB WASM  | No                          | No                          | Embedded                    | Sep 2025          | Set membership only, no ranking      |
| Elasticlunr  | ~12KB       | Limited                     | No                        | Yes                         | 2016 (dead)       | Skip                                 |

## Why MiniSearch won

1. **Per-document-type weighting is a one-liner.** The `boostDocument(id, term, storedFields) => number` query-time callback has access to stored fields:

   ```js
   ms.search('openpai', {
     fuzzy: 0.2,
     prefix: true,
     boostDocument: (id, term, fields) => yamlWeights[fields.type] ?? 1.0,
   });
   ```

   Orama needs a custom sorter for this, and the other candidates have no per-document boost.

2. **Index format is documented and stable.** The MiniSearch CHANGELOG says the maintainer stabilized the JSON format "to facilitate tools that create a serialized index in other languages."

3. **True Levenshtein typo tolerance.** `fuzzy: 0.2` allows up to 20% of term length as edit distance. It matches "openpai" to "openapi" (a transposition) and "petsore" to "PetStore".

4. **Smallest full-text engine.** MiniSearch is about 5.8 KB gzipped, MIT-licensed, written in TypeScript, and maintained.

## Chosen architecture: build-time index, MiniSearch runtime

Superseded in part. aid builds the index with MiniSearch itself, in TypeScript on Bun (`src/core/search-index.ts`), and writes `ms.toJSON()` to `search-index.<hash>.js`. The browser loads MiniSearch through `import("minisearch")` inside the `aid-web.js` bundle, and no `minisearch.min.js` file exists. The design below is the one this brief proposed.

The brief proposed that the aid binary write MiniSearch's documented JSON index format from Go or Rust, with no embedded JavaScript runtime. The browser calls `MiniSearch.loadJSON(...)` and can query at once, with no `addAll` pass at any site size.

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

### Why a .js wrapper instead of .json

- V8 caches the bytecode of a `.js` file after the first load, so later visits in Chromium browsers skip parsing.
- The index loads in one request without a `fetch().then(JSON.parse)` step.
- The filename hash changes with the content, which busts caches.

### Why this design over the alternatives

- **Indexing in the browser.** A precomputed index removes the indexing step before the first search. On a 5000-page site this should cut the first-search delay from seconds to milliseconds (estimate, not measured).
- **Writing our own engine.** MiniSearch already has tested BM25 ranking, Levenshtein matching, prefix matching, and `boostDocument`.
- **Pagefind.** Pagefind has no Levenshtein typo tolerance, so "openpai" does not find "openapi".

### Risk

Resolved: build and browser use the same `minisearch` package, so a format change cannot split them.

## Open questions

1. Resolved: aid ships a default search UI (`src/theme/components/SearchBox.tsx` and `src/web/search.ts`).
2. **Stemming.** MiniSearch has no language packs. Should v1 ship an English Snowball stemmer, or support a stemmer per language? This is still open.
3. Partly resolved: the build hashes the index filename. Still open: confirm that common static hosts can send an immutable cache header for it.

## Sources

- [MiniSearch repo](https://github.com/lucaong/minisearch) | [CHANGELOG](https://github.com/lucaong/minisearch/blob/master/CHANGELOG.md) | [SearchOptions](https://lucaong.github.io/minisearch/types/MiniSearch.SearchOptions.html) | [Bundlephobia](https://bundlephobia.com/package/minisearch)
- [Orama releases](https://github.com/oramasearch/orama/releases) | [persistence plugin](https://docs.orama.com/docs/orama-js/plugins/plugin-data-persistence)
- [FlexSearch repo](https://github.com/nextapps-de/flexsearch) | [fuzzy issue #118](https://github.com/nextapps-de/flexsearch/issues/118)
- [Pagefind site](https://pagefind.app/) | [weighting](https://pagefind.app/docs/weighting/) | [Rust crate](https://docs.rs/pagefind/latest/pagefind/index.html)
- [PkgPulse 2026: Fuse.js vs FlexSearch vs Orama](https://www.pkgpulse.com/blog/fusejs-vs-flexsearch-vs-orama-client-side-search-2026)
- [Stork sunset notice](https://github.com/jameslittle230/stork/discussions/360)
- [TinySearch releases](https://github.com/tinysearch/tinysearch/releases)
