/**
 * Lazy-load MiniSearch + the precomputed index on first focus of any search
 * input. Stub.
 */
export function attachSearch(): void {
  const inputs = document.querySelectorAll<HTMLInputElement>("[data-aid-search-input]")
  for (const input of inputs) {
    input.addEventListener(
      "focus",
      () => {
        // load search-index.js + minisearch.min.js once
      },
      { once: true },
    )
  }
}
