import { attachAIButtons } from "./ai-button"
import { attachDarkMode } from "./dark-mode"
import { attachSearch } from "./search"

document.addEventListener("DOMContentLoaded", () => {
  attachSearch()
  attachAIButtons()
  attachDarkMode()
})
