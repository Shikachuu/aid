type SearchHit = { id: string; type: string; title: string; url: string }
type Weights = Record<string, number>

const MAX_RESULTS = 8
const DEBOUNCE_MS = 80
const BLUR_CLOSE_DELAY_MS = 150

/**
 * Lazy-load MiniSearch and the precomputed index on first focus of any search
 * input, then wire a keyboard-navigable results dropdown. The input element
 * carries every piece of state the client needs (index URL, typo tolerance,
 * per-format weights) via `data-aid-search-*` attributes stamped by the
 * server-rendered SearchBox.
 */
export function attachSearch(): void {
  const inputs = document.querySelectorAll<HTMLInputElement>("[data-aid-search-input]")
  for (const input of inputs) {
    wireInput(input)
  }
}

function wireInput(input: HTMLInputElement): void {
  const rootEl = input.closest<HTMLElement>(".aid-search")
  const resultsEl = rootEl?.querySelector<HTMLElement>("[data-aid-search-results]")
  const indexHrefRaw = input.dataset.aidSearchIndexHref
  if (!rootEl || !resultsEl || !indexHrefRaw) {
    return
  }
  const root: HTMLElement = rootEl
  const results: HTMLElement = resultsEl
  const indexHref: string = indexHrefRaw

  const typoToleranceRaw = Number(input.dataset.aidSearchTypoTolerance ?? "0")
  const typoTolerance = Number.isFinite(typoToleranceRaw) ? typoToleranceRaw : 0
  const weights = parseWeights(input.dataset.aidSearchWeights)

  let ms: MiniSearchLike | null = null
  let ready = false
  let loadPromise: Promise<void> | null = null
  let items: SearchHit[] = []
  let active = -1
  let debounce: ReturnType<typeof setTimeout> | null = null

  input.addEventListener("focus", () => {
    if (loadPromise === null && !ready) {
      loadPromise = load()
    }
  })

  input.addEventListener("input", () => {
    if (debounce !== null) {
      clearTimeout(debounce)
    }
    debounce = setTimeout(() => runQuery(input.value), DEBOUNCE_MS)
  })

  input.addEventListener("keydown", (e) => {
    if (results.hidden) {
      return
    }
    if (e.key === "ArrowDown") {
      e.preventDefault()
      active = Math.min(active + 1, items.length - 1)
      renderActive()
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      active = Math.max(active - 1, 0)
      renderActive()
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

  document.addEventListener("click", (e) => {
    if (!root.contains(e.target as Node)) {
      close()
    }
  })

  async function load(): Promise<void> {
    const [{ default: MiniSearchCtor }] = await Promise.all([
      import("minisearch"),
      loadIndexScript(indexHref),
    ])
    const data = (window as unknown as { __AID_SEARCH__?: unknown }).__AID_SEARCH__
    if (data === undefined) {
      return
    }
    const Ctor = MiniSearchCtor as unknown as MiniSearchStatic
    ms = Ctor.loadJSON(JSON.stringify(data), {
      fields: ["title", "headings", "body", "extras"],
      storeFields: ["type", "title", "url"],
      searchOptions: { boost: { title: 3, headings: 2 } },
    })
    ready = true
    runQuery(input.value)
  }

  function runQuery(q: string): void {
    if (!ready || ms === null || q.trim() === "") {
      items = []
      active = -1
      render()
      return
    }
    const raw = ms.search(q, {
      fuzzy: typoTolerance,
      prefix: true,
      boostDocument: (_id, _term, doc) => {
        const t = typeof doc.type === "string" ? doc.type : ""
        return weights[t] ?? 1
      },
    })
    items = raw.slice(0, MAX_RESULTS).map((r) => ({
      id: String(r.id),
      type: typeof r.type === "string" ? r.type : "",
      title: typeof r.title === "string" ? r.title : "",
      url: typeof r.url === "string" ? r.url : "",
    }))
    active = items.length > 0 ? 0 : -1
    render()
  }

  function render(): void {
    results.replaceChildren()
    if (items.length === 0) {
      results.hidden = true
      input.setAttribute("aria-expanded", "false")
      return
    }
    const frag = document.createDocumentFragment()
    items.forEach((hit, i) => {
      const link = document.createElement("a")
      link.href = hit.url
      link.className = "aid-search-result"
      link.setAttribute("role", "option")
      link.setAttribute("aria-selected", i === active ? "true" : "false")
      link.dataset.aidSearchResultIndex = String(i)

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
      frag.appendChild(link)
    })
    results.appendChild(frag)
    results.hidden = false
    input.setAttribute("aria-expanded", "true")
  }

  function renderActive(): void {
    const children = results.querySelectorAll<HTMLElement>("[data-aid-search-result-index]")
    children.forEach((c, i) => {
      c.setAttribute("aria-selected", i === active ? "true" : "false")
    })
  }

  function close(): void {
    results.hidden = true
    input.setAttribute("aria-expanded", "false")
  }
}

function parseWeights(raw: string | undefined): Weights {
  if (raw === undefined) {
    return {}
  }
  try {
    const parsed = JSON.parse(raw) as unknown
    if (parsed === null || typeof parsed !== "object") {
      return {}
    }
    const out: Weights = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v)) {
        out[k] = v
      }
    }
    return out
  } catch {
    return {}
  }
}

async function loadIndexScript(href: string): Promise<void> {
  const selector = `script[data-aid-search-index-src="${cssEscape(href)}"]`
  const existing = document.querySelector<HTMLScriptElement>(selector)
  if (existing) {
    if ((window as unknown as { __AID_SEARCH__?: unknown }).__AID_SEARCH__ !== undefined) {
      return
    }
    await new Promise<void>((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true })
      existing.addEventListener("error", () => reject(new Error(`aid: failed to load ${href}`)), {
        once: true,
      })
    })
    return
  }
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script")
    script.src = href
    script.async = true
    script.dataset.aidSearchIndexSrc = href
    script.addEventListener("load", () => resolve(), { once: true })
    script.addEventListener("error", () => reject(new Error(`aid: failed to load ${href}`)), {
      once: true,
    })
    document.head.appendChild(script)
  })
}

function cssEscape(value: string): string {
  const cssApi = (window as unknown as { CSS?: { escape?: (s: string) => string } }).CSS
  if (cssApi?.escape) {
    return cssApi.escape(value)
  }
  return value.replace(/["\\]/g, "\\$&")
}

type MiniSearchSearchOptions = {
  fuzzy?: number
  prefix?: boolean
  boostDocument?: (id: string, term: string, doc: Record<string, unknown>) => number
}

type MiniSearchLike = {
  search: (query: string, options?: MiniSearchSearchOptions) => Array<Record<string, unknown>>
}

type MiniSearchLoadOptions = {
  fields: string[]
  storeFields?: string[]
  searchOptions?: { boost?: Record<string, number> }
}

type MiniSearchStatic = {
  loadJSON: (json: string, options: MiniSearchLoadOptions) => MiniSearchLike
}
