/** Attach a click handler to the header dark-mode toggle. The handler does nothing yet. */
export function attachDarkMode(): void {
  const toggle = document.querySelector<HTMLElement>("[data-aid-dark-toggle]")
  if (!toggle) {
    return
  }
  toggle.addEventListener("click", () => {})
}
