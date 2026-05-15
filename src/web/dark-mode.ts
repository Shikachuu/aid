/**
 * Toggle data-aid-theme on <html> between "light" / "dark" / "auto" and
 * persist to localStorage. Respects prefers-color-scheme on first load.
 *
 * Stub.
 */
export function attachDarkMode(): void {
  const toggle = document.querySelector<HTMLElement>("[data-aid-dark-toggle]")
  if (!toggle) {
    return
  }
  toggle.addEventListener("click", () => {
    // cycle theme + persist
  })
}
