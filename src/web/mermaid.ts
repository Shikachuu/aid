const MERMAID_SELECTOR = "pre.mermaid, div.mermaid"

/**
 * Render every `pre.mermaid` and `div.mermaid` block, and render again when the OS color scheme changes.
 * With `theme.dark_mode: off` the diagrams stay on the light theme.
 * The page imports mermaid only when it has a diagram.
 */
export async function attachMermaid(): Promise<void> {
  const elements = [...document.querySelectorAll<HTMLElement>(MERMAID_SELECTOR)]
  if (elements.length === 0) {
    return
  }
  const sources = elements.map((el) => el.textContent)
  const media = window.matchMedia("(prefers-color-scheme: dark)")

  const { default: mermaid } = await import("mermaid")
  const render = async () => {
    elements.forEach((el, i) => {
      // mermaid skips nodes that carry data-processed.
      el.removeAttribute("data-processed")
      el.textContent = sources[i] ?? ""
    })
    const dark = document.documentElement.dataset.aidDarkMode !== "off" && media.matches
    mermaid.initialize({ startOnLoad: false, theme: dark ? "dark" : "default" })
    await mermaid.run({ querySelector: MERMAID_SELECTOR, suppressErrors: true })
  }

  await render()
  media.addEventListener("change", () => {
    void render()
  })
}
