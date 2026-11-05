import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import type { Browser } from "playwright"
import {
  type BuiltSite,
  buildSite,
  computedColor,
  type DarkMode,
  E2E,
  launchBrowser,
  luminance,
  openPage,
  type Scheme,
  screenshot,
} from "./site"

setDefaultTimeout(60_000)

const MERMAID_SVG = "pre.mermaid svg"
// Mermaid first inserts an empty measuring svg, so wait for a rendered node.
const MERMAID_NODE = `${MERMAID_SVG} g.node`

type Expectation = { mode: DarkMode; scheme: Scheme; dark: boolean }

const CASES: Expectation[] = [
  { mode: "auto", scheme: "light", dark: false },
  { mode: "auto", scheme: "dark", dark: true },
  { mode: "manual", scheme: "light", dark: false },
  { mode: "manual", scheme: "dark", dark: true },
  { mode: "off", scheme: "dark", dark: false },
]

describe.skipIf(!E2E)("theme.dark_mode in Chromium", () => {
  const sites = new Map<DarkMode, BuiltSite>()
  let browser: Browser

  beforeAll(async () => {
    for (const mode of ["auto", "manual", "off"] as const) {
      sites.set(mode, await buildSite(mode))
    }
    browser = await launchBrowser()
  })

  afterAll(async () => {
    await browser?.close()
    for (const site of sites.values()) {
      await site.close()
    }
  })

  const site = (mode: DarkMode): BuiltSite => {
    const built = sites.get(mode)
    if (!built) {
      throw new Error(`site for ${mode} was not built`)
    }
    return built
  }

  for (const { mode, scheme, dark } of CASES) {
    const look = dark ? "dark" : "light"

    test(`${mode} on a ${scheme} OS renders the page and mermaid ${look}`, async () => {
      const { context, page, errors } = await openPage(browser, "desktop", scheme)
      try {
        await page.goto(site(mode).url(""))
        await page.locator(MERMAID_NODE).first().waitFor()
        expect(await page.locator("html").getAttribute("data-aid-dark-mode")).toBe(mode)
        const pageBg = luminance(await computedColor(page, "body", "backgroundColor"))
        // Mermaid's root fill is the diagram text color: dark text on the light theme.
        const mermaidText = luminance(await computedColor(page, MERMAID_SVG, "fill"))
        await screenshot(page, `${mode}-markdown-desktop-${scheme}`)
        expect(pageBg > 0.5).toBe(!dark)
        expect(mermaidText > 0.5).toBe(dark)
        expect(errors).toEqual([])
      } finally {
        await context.close()
      }
    })

    test(`${mode} on a ${scheme} OS renders the OpenAPI reference ${look}`, async () => {
      const { context, page } = await openPage(browser, "desktop", scheme)
      try {
        await page.goto(site(mode).url("api/"))
        await page
          .locator("#aid-openapi-mount")
          .getByText("List all pets")
          .filter({ visible: true })
          .first()
          .waitFor()
        await screenshot(page, `${mode}-openapi-desktop-${scheme}`)
        expect(await page.locator("body").getAttribute("class")).toContain(
          dark ? "dark-mode" : "light-mode",
        )
        const app = luminance(await computedColor(page, ".scalar-app", "backgroundColor"))
        expect(app > 0.5).toBe(!dark)
      } finally {
        await context.close()
      }
    })
  }
})
