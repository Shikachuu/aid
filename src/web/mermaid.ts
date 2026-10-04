/**
 * Render every `<pre class="mermaid">` block, and render again when the OS color scheme changes.
 * The page imports mermaid only when it has a diagram.
 */
export async function attachMermaid(): Promise<void> {
  const elements = [...document.querySelectorAll<HTMLElement>("pre.mermaid")]
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
    const attr = document.documentElement.dataset.aidTheme
    const dark = attr === "dark" || (attr !== "light" && media.matches)
    mermaid.initialize({ startOnLoad: false, theme: dark ? "dark" : "default" })
    await mermaid.run({ querySelector: "pre.mermaid", suppressErrors: true })
  }

  await render()
  media.addEventListener("change", () => {
    void render()
  })
}
