/**
 * Wire each "Open in AI" button to the configured target's documented
 * "open with prompt" URL pattern. Stub.
 */
export function attachAIButtons(): void {
  const buttons = document.querySelectorAll<HTMLElement>("[data-aid-ai-button]")
  for (const button of buttons) {
    button.addEventListener("click", () => {
      // build URL from data-machine-url + selected target, then window.open
    })
  }
}
