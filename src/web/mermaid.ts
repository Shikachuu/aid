/**
 * Render any `<pre class="mermaid">` blocks on the page. The mermaid library
 * is ~600 kB — we only fetch it when the current page actually contains a
 * diagram, so prose-only pages pay no cost. Theme tracks the OS color
 * preference; a media-query listener re-runs mermaid on light/dark flips by
 * resetting the `data-processed` attribute mermaid uses to skip already-
 * rendered nodes.
 */
export async function attachMermaid(): Promise<void> {
  const elements = document.querySelectorAll<HTMLElement>("pre.mermaid")
  if (elements.length === 0) {
    return
  }
  const originals = new WeakMap<HTMLElement, string>()
  for (const el of elements) {
    originals.set(el, el.textContent ?? "")
  }

  const { default: mermaid } = await import("mermaid")
  const render = async () => {
    for (const el of elements) {
      el.removeAttribute("data-processed")
      const src = originals.get(el)
      if (src !== undefined) {
        el.textContent = src
      }
    }
    mermaid.initialize({ startOnLoad: false, theme: currentTheme() })
    await mermaid.run({ querySelector: "pre.mermaid", suppressErrors: true })
  }

  await render()
  const media = window.matchMedia("(prefers-color-scheme: dark)")
  media.addEventListener("change", () => {
    void render()
  })
}

function currentTheme(): "default" | "dark" {
  const attr = document.documentElement.dataset.aidTheme
  if (attr === "dark") {
    return "dark"
  }
  if (attr === "light") {
    return "default"
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "default"
}
