import { describe, expect, test } from "bun:test"
import { AidConfigSchema } from "../../src/core/config"
import { renderDocument } from "../../src/jsx-runtime"
import { Layout } from "../../src/theme/components/Layout"

const page = (theme: Record<string, unknown> = {}) =>
  renderDocument(
    Layout({
      config: AidConfigSchema.parse({ name: "T", theme }),
      title: "Home",
      nav: [{ label: "Home", path: "/" }],
      currentPath: "/",
      stylesheetHref: "/main.css",
      webBundleHref: "/aid.js",
      bodyHtml: "<p>hi</p>",
    }),
  )

describe("Layout", () => {
  test("marks the document with the dark_mode setting", () => {
    expect(page()).toContain('<html lang="en" data-aid-dark-mode="auto">')
    expect(page({ dark_mode: "off" })).toContain('data-aid-dark-mode="off"')
  })

  test("wraps the sidebar nav in a details disclosure for narrow screens", () => {
    expect(page()).toMatch(
      /<aside class="aid-sidebar"><details class="aid-sidebar-disclosure"><summary class="aid-sidebar-toggle">Menu<\/summary><nav class="aid-nav"/,
    )
  })

  test("renders no dark toggle or AI button stubs", () => {
    expect(page()).not.toMatch(/aid-dark-toggle|data-aid-ai-button|data-machine-url/)
  })
})
