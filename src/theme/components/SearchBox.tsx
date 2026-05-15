/** Per-format ranking boosts surfaced to the client via a JSON-encoded data attribute. */
export type SearchBoxWeights = Record<string, number>

/** Props for {@link SearchBox}. */
export type SearchBoxProps = {
  /** Public href of the hashed search-index JS file. Omit to disable search entirely. */
  indexHref?: string
  /** Fraction of term length allowed as edit distance (mirrors `search.typo_tolerance`). */
  typoTolerance: number
  /** Per-format ranking boosts applied at query time via MiniSearch's `boostDocument`. */
  weights: SearchBoxWeights
}

/**
 * Server-rendered search affordance. Renders nothing when `indexHref` is
 * undefined (search disabled). When enabled, the input carries data attributes
 * the client-side `attachSearch()` reads: the index URL, the typo-tolerance
 * fraction, and the per-format weights as JSON.
 */
export function SearchBox(props: SearchBoxProps) {
  if (props.indexHref === undefined) {
    return null
  }
  const weightsJson = JSON.stringify(props.weights)
  return (
    <div class="aid-search">
      <input
        type="search"
        placeholder="Search docs…"
        aria-label="Search"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded="false"
        aria-controls="aid-search-results"
        data-aid-search-input
        data-aid-search-index-href={props.indexHref}
        data-aid-search-typo-tolerance={String(props.typoTolerance)}
        data-aid-search-weights={weightsJson}
      />
      <div
        id="aid-search-results"
        class="aid-search-results"
        role="listbox"
        data-aid-search-results
        hidden
      />
    </div>
  )
}
