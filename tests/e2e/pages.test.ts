import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import type { Browser, Page } from "playwright"
import {
  BASE_PATH,
  type BuiltSite,
  buildSite,
  E2E,
  launchBrowser,
  MERMAID_NODE,
  openPage,
  type Scheme,
  screenshot,
  VIEWPORTS,
  type ViewportName,
} from "./site"

setDefaultTimeout(60_000)

type PageKind = { name: string; route: string; ready: (page: Page) => Promise<void> }

const PAGE_KINDS: PageKind[] = [
  {
    name: "markdown",
    route: "",
    ready: async (page) => {
      await page.locator(".aid-callout-note").waitFor()
      await page.locator("pre.shiki").first().waitFor()
      await page.locator(MERMAID_NODE).first().waitFor()
    },
  },
  {
    name: "html",
    route: "about/",
    ready: async (page) => {
      await page.getByRole("heading", { level: 1, name: "About the Fixture" }).waitFor()
      await page.locator(MERMAID_NODE).first().waitFor()
    },
  },
  {
    name: "openapi",
    route: "api/",
    ready: (page) =>
      page
        .locator("#aid-openapi-mount")
        .getByText("List all pets")
        .filter({ visible: true })
        .first()
        .waitFor(),
  },
  {
    name: "proto",
    route: "events/",
    ready: (page) =>
      page.locator("#aid-proto-mount .proto-entity-name", { hasText: "EventBus" }).waitFor(),
  },
  {
    name: "jsonschema",
    route: "user/",
    ready: (page) => page.getByRole("heading", { level: 1, name: "User" }).waitFor(),
  },
]

const COMBOS: [ViewportName, Scheme][] = [
  ["desktop", "light"],
  ["desktop", "dark"],
  ["mobile", "light"],
  ["mobile", "dark"],
]

describe.skipIf(!E2E)("page kinds in Chromium", () => {
  let site: BuiltSite
  let browser: Browser

  beforeAll(async () => {
    site = await buildSite("auto")
    browser = await launchBrowser()
  })

  afterAll(async () => {
    await browser?.close()
    await site?.close()
  })

  for (const [viewport, scheme] of COMBOS) {
    for (const kind of PAGE_KINDS) {
      test(`${kind.name} renders at ${viewport} ${scheme} without horizontal overflow`, async () => {
        const { context, page, errors } = await openPage(browser, viewport, scheme)
        try {
          await page.goto(site.url(kind.route))
          await kind.ready(page)
          await screenshot(page, `auto-${kind.name}-${viewport}-${scheme}`)
          const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
          expect(scrollWidth).toBeLessThanOrEqual(VIEWPORTS[viewport].width)
          expect(errors).toEqual([])
        } finally {
          await context.close()
        }
      })
    }
  }

  test("search opens on typing and Enter navigates to the top hit", async () => {
    const { context, page } = await openPage(browser, "desktop", "light")
    try {
      await page.goto(site.url(""))
      const input = page.locator("[data-aid-search-input]")
      await input.click()
      await input.pressSequentially("pets")
      const first = page.locator("[data-aid-search-results] a.aid-search-result").first()
      await first.waitFor()
      expect(await first.getAttribute("aria-selected")).toBe("true")
      expect(await first.locator(".aid-search-result-title").textContent()).toBe("Sample API")
      await screenshot(page, "auto-search-desktop-light")
      await input.press("Enter")
      await page.waitForURL(`**${BASE_PATH}/api`)
    } finally {
      await context.close()
    }
  })

  test("search ignores Enter while an IME composes", async () => {
    const { context, page } = await openPage(browser, "desktop", "light")
    try {
      await page.goto(site.url(""))
      const input = page.locator("[data-aid-search-input]")
      await input.click()
      await input.pressSequentially("pets")
      await page.locator("[data-aid-search-results] a.aid-search-result").first().waitFor()
      const handled = await input.evaluate((el) =>
        [{ isComposing: true }, { keyCode: 229 }].map(
          (init) =>
            !el.dispatchEvent(
              new KeyboardEvent("keydown", {
                key: "Enter",
                bubbles: true,
                cancelable: true,
                ...init,
              }),
            ),
        ),
      )
      expect(handled).toEqual([false, false])
      await input.press("Enter")
      await page.waitForURL(`**${BASE_PATH}/api`)
    } finally {
      await context.close()
    }
  })

  test("mobile sidebar is a closed disclosure that opens on tap", async () => {
    const { context, page } = await openPage(browser, "mobile", "light")
    try {
      await page.goto(site.url(""))
      await page.locator(MERMAID_NODE).first().waitFor()
      const toggle = page.locator("summary.aid-sidebar-toggle")
      const nav = page.locator("nav.aid-nav")
      expect(await toggle.isVisible()).toBe(true)
      expect(await nav.isVisible()).toBe(false)
      const main = await page.locator("main.aid-main").boundingBox()
      expect(main?.width).toBeGreaterThanOrEqual(VIEWPORTS.mobile.width - 32)
      await toggle.click()
      await nav.waitFor()
      await screenshot(page, "auto-nav-open-mobile-light")
    } finally {
      await context.close()
    }
  })

  test("desktop sidebar shows the nav without a toggle", async () => {
    const { context, page } = await openPage(browser, "desktop", "light")
    try {
      await page.goto(site.url(""))
      expect(await page.locator("summary.aid-sidebar-toggle").isVisible()).toBe(false)
      expect(await page.locator("nav.aid-nav").isVisible()).toBe(true)
    } finally {
      await context.close()
    }
  })
})
