/** Search settings that the server renders into the input for the browser search runtime. */
export type SearchBoxProps = {
  /** Public href of the hashed search-index JS file. */
  indexHref: string
  /** Fraction of term length allowed as edit distance (mirrors `search.typo_tolerance`). */
  typoTolerance: number
  /** Ranking boost per page type, for example `openapi: 2`. Unlisted types get 1. */
  weights: Record<string, number>
}

/**
 * Render the search input and results list. `attachSearch` reads the `data-aid-search-*`
 * attributes.
 */
export function SearchBox(props: SearchBoxProps) {
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
