import type { AsPlainObject, default as MiniSearch } from "minisearch"
import { SEARCH_OPTIONS } from "../core/search-options"

type SearchHit = { type: string; title: string; url: string }

const MAX_RESULTS = 8
const DEBOUNCE_MS = 80
const BLUR_CLOSE_DELAY_MS = 150

/**
 * Wire every search input to the prebuilt index. The index and MiniSearch load on the first focus.
 * The input's `data-aid-search-*` attributes, set by the SearchBox component, carry the settings.
 */
export function attachSearch(): void {
  const inputs = document.querySelectorAll<HTMLInputElement>("[data-aid-search-input]")
  for (const input of inputs) {
    const results = input
      .closest(".aid-search")
      ?.querySelector<HTMLElement>("[data-aid-search-results]")
    const indexHref = input.dataset.aidSearchIndexHref
    if (results && indexHref) {
      wireInput(input, results, indexHref)
    }
  }
}

function wireInput(input: HTMLInputElement, results: HTMLElement, indexHref: string): void {
  const typoTolerance = Number(input.dataset.aidSearchTypoTolerance)
  const weights: Record<string, number> = JSON.parse(input.dataset.aidSearchWeights ?? "{}")

  let ms: MiniSearch | null = null
  let loading = false
  let items: SearchHit[] = []
  let active = -1
  let debounce: ReturnType<typeof setTimeout> | undefined

  input.addEventListener("focus", () => {
    if (!loading) {
      loading = true
      void load()
    }
  })

  input.addEventListener("input", () => {
    clearTimeout(debounce)
    debounce = setTimeout(() => runQuery(input.value), DEBOUNCE_MS)
  })

  input.addEventListener("keydown", (e) => {
    if (results.hidden) {
      return
    }
    if (e.key === "ArrowDown") {
      e.preventDefault()
      active = Math.min(active + 1, items.length - 1)
      markActive()
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      active = Math.max(active - 1, 0)
      markActive()
    } else if (e.key === "Enter") {
      const hit = items[active]
      if (hit) {
        e.preventDefault()
        window.location.href = hit.url
      }
    } else if (e.key === "Escape") {
      e.preventDefault()
      input.value = ""
      items = []
      active = -1
      render()
    }
  })

  input.addEventListener("blur", () => {
    // Defer so a click on a result registers before the dropdown hides.
    setTimeout(close, BLUR_CLOSE_DELAY_MS)
  })

  async function load(): Promise<void> {
    const [{ default: MiniSearchCtor }] = await Promise.all([
      import("minisearch"),
      loadIndexScript(indexHref),
    ])
    const data = (window as { __AID_SEARCH__?: AsPlainObject }).__AID_SEARCH__
    if (data === undefined) {
      return
    }
    ms = MiniSearchCtor.loadJS(data, SEARCH_OPTIONS)
    runQuery(input.value)
  }

  function runQuery(q: string): void {
    if (ms === null || q.trim() === "") {
      items = []
      active = -1
      render()
      return
    }
    const raw = ms.search(q, {
      fuzzy: typoTolerance,
      prefix: true,
      boostDocument: (_id, _term, doc) => weights[doc?.type as string] ?? 1,
    })
    items = raw.slice(0, MAX_RESULTS) as unknown as SearchHit[]
    active = items.length > 0 ? 0 : -1
    render()
  }

  function render(): void {
    results.replaceChildren(...items.map(toLink))
    results.hidden = items.length === 0
    input.setAttribute("aria-expanded", String(items.length > 0))
    markActive()
  }

  function markActive(): void {
    for (const [i, link] of [...results.children].entries()) {
      link.setAttribute("aria-selected", String(i === active))
    }
  }

  function close(): void {
    results.hidden = true
    input.setAttribute("aria-expanded", "false")
  }
}

function toLink(hit: SearchHit): HTMLAnchorElement {
  const link = document.createElement("a")
  link.href = hit.url
  link.className = "aid-search-result"
  link.setAttribute("role", "option")

  const badge = document.createElement("span")
  badge.className = `aid-search-badge aid-search-badge-${hit.type}`
  badge.textContent = hit.type

  const title = document.createElement("span")
  title.className = "aid-search-result-title"
  title.textContent = hit.title

  const url = document.createElement("span")
  url.className = "aid-search-result-url"
  url.textContent = hit.url

  link.append(badge, title, url)
  return link
}

function loadIndexScript(src: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    document.head.append(
      Object.assign(document.createElement("script"), { src, onload: resolve, onerror: reject }),
    )
  })
}
