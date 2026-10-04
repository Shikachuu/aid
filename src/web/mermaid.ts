/**
 * Render any `<pre class="mermaid">` blocks on the page. The mermaid library
 * is ~600 kB — we only fetch it when the current page actually contains a
 * diagram, so prose-only pages pay no cost. Theme tracks the OS color
 * preference; a media-query listener re-runs mermaid on light/dark flips by
 * resetting the `data-processed` attribute mermaid uses to skip already-
 * rendered nodes.
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
