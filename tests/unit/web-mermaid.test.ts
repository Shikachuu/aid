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

let onSchemeChange: () => void = () => {}

const prefersDark = (matches: boolean) => {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    addEventListener: (_: string, listener: () => void) => {
      onSchemeChange = listener
    },
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

  test("runs one render at a time when the scheme flips quickly", async () => {
    const { attachMermaid } = await import("../../src/web/mermaid")
    prefersDark(false)
    await attachMermaid()
    let active = 0
    let peak = 0
    const done = Promise.withResolvers<boolean>()
    run.mockImplementation(async () => {
      peak = Math.max(peak, ++active)
      await Bun.sleep(0)
      active--
      if (run.mock.calls.length === 3) {
        done.resolve(true)
      }
    })
    onSchemeChange()
    onSchemeChange()
    await done.promise
    expect(peak).toBe(1)
    run.mockImplementation(async () => {})
  })
})
