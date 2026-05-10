export function SearchBox() {
  return (
    <div class="aid-search">
      <input type="search" placeholder="Search docs…" aria-label="Search" data-aid-search-input />
      <div class="aid-search-results" data-aid-search-results hidden />
    </div>
  )
}
