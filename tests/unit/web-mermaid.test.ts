import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test"
import { GlobalRegistrator } from "@happy-dom/global-registrator"

const initialize = mock((_: { theme: string }) => {})
const run = mock(async () => {})
void mock.module("mermaid", () => ({ default: { initialize, run } }))

beforeAll(() => {
  GlobalRegistrator.register()
})

afterAll(async () => {
  await GlobalRegistrator.unregister()
})

const prefersDark = (matches: boolean) => {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    addEventListener: () => {},
  })) as unknown as typeof window.matchMedia
}

beforeEach(() => {
  initialize.mockClear()
  run.mockClear()
  document.body.innerHTML = '<pre class="mermaid">graph TD; A-->B</pre>'
})

describe("attachMermaid", () => {
  test("follows a dark OS scheme by default", async () => {
    const { attachMermaid } = await import("../../src/web/mermaid")
    prefersDark(true)
    document.documentElement.dataset.aidDarkMode = "auto"
    await attachMermaid()
    expect(initialize.mock.calls[0]?.[0].theme).toBe("dark")
  })

  test("stays on the light theme on a dark OS when dark_mode is off", async () => {
    const { attachMermaid } = await import("../../src/web/mermaid")
    prefersDark(true)
    document.documentElement.dataset.aidDarkMode = "off"
    await attachMermaid()
    expect(initialize.mock.calls[0]?.[0].theme).toBe("default")
  })

  test("skips the mermaid import when the page has no diagram", async () => {
    const { attachMermaid } = await import("../../src/web/mermaid")
    document.body.innerHTML = "<p>none</p>"
    await attachMermaid()
    expect(initialize).not.toHaveBeenCalled()
  })
})
