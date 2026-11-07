import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, spyOn, test } from "bun:test"
import { GlobalRegistrator } from "@happy-dom/global-registrator"
import MiniSearch from "minisearch"
import { SEARCH_OPTIONS } from "../../src/core/search-options"
import { attachSearch } from "../../src/web/search"

type HappyWindow = { happyDOM: { settings: { handleDisabledFileLoadingAsSuccess: boolean } } }

beforeAll(() => {
  GlobalRegistrator.register({
    url: "http://localhost:3000/",
    settings: { disableJavaScriptFileLoading: true, handleDisabledFileLoadingAsSuccess: true },
  })
})

afterAll(async () => {
  await GlobalRegistrator.unregister()
})

const indexLoads = (ok: boolean) => {
  ;(window as unknown as HappyWindow).happyDOM.settings.handleDisabledFileLoadingAsSuccess = ok
}

const setIndex = (titles: string[]) => {
  const ms = new MiniSearch(SEARCH_OPTIONS)
  ms.addAll(titles.map((title, id) => ({ id, type: "markdown", title, url: `/${title}/` })))
  ;(window as { __AID_SEARCH__?: unknown }).__AID_SEARCH__ = JSON.parse(JSON.stringify(ms))
}

let input: HTMLInputElement
let results: HTMLElement

beforeEach(() => {
  document.body.innerHTML = `<div class="aid-search">
    <input data-aid-search-input data-aid-search-index-href="/search.js" data-aid-search-typo-tolerance="0.2" data-aid-search-weights="{}">
    <div data-aid-search-results hidden></div>
  </div>`
  input = document.querySelector("input") as HTMLInputElement
  results = document.querySelector("[data-aid-search-results]") as HTMLElement
  indexLoads(true)
  setIndex(["alpha", "alpine", "beta"])
  attachSearch()
})

afterEach(() => {
  delete (window as { __AID_SEARCH__?: unknown }).__AID_SEARCH__
})

const typeQuery = async (q: string) => {
  input.focus()
  input.value = q
  input.dispatchEvent(new Event("input"))
  await Bun.sleep(150)
}

const key = (init: KeyboardEventInit) => {
  const event = new KeyboardEvent("keydown", { cancelable: true, ...init })
  input.dispatchEvent(event)
  return event
}

const selected = () =>
  [...results.children].findIndex((el) => el.getAttribute("aria-selected") === "true")

describe("attachSearch", () => {
  test("lists matching pages and moves the selection with the arrow keys", async () => {
    await typeQuery("alp")
    expect(results.hidden).toBe(false)
    expect(
      [...results.querySelectorAll(".aid-search-result-title")].map((e) => e.textContent),
    ).toEqual(["alpha", "alpine"])
    expect(selected()).toBe(0)
    expect(key({ key: "ArrowDown" }).defaultPrevented).toBe(true)
    expect(selected()).toBe(1)
  })

  test("leaves keys to the IME while it composes text", async () => {
    await typeQuery("alp")
    expect(key({ key: "ArrowDown", isComposing: true }).defaultPrevented).toBe(false)
    expect(key({ key: "Enter", keyCode: 229 }).defaultPrevented).toBe(false)
    expect(selected()).toBe(0)
  })

  test("recovers on the next focus after the index fails to load", async () => {
    const warn = spyOn(console, "warn").mockImplementation(() => {})
    const error = spyOn(console, "error").mockImplementation(() => {})
    try {
      document.head.innerHTML = ""
      indexLoads(false)
      await typeQuery("alp")
      expect(results.hidden).toBe(true)
      input.blur()
      await typeQuery("alp")
      expect(warn).toHaveBeenCalledTimes(1)
      expect(document.head.querySelectorAll("script")).toHaveLength(0)

      indexLoads(true)
      input.blur()
      await typeQuery("alp")
      expect(results.hidden).toBe(false)
    } finally {
      warn.mockRestore()
      error.mockRestore()
    }
  })
})
