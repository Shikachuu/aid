/** Attach click handlers to the "Open in AI" buttons. The handlers do nothing yet. */
export function attachAIButtons(): void {
  const buttons = document.querySelectorAll<HTMLElement>("[data-aid-ai-button]")
  for (const button of buttons) {
    button.addEventListener("click", () => {})
  }
}
