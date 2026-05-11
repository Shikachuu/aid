import { attachAIButtons } from "./ai-button"
import { attachDarkMode } from "./dark-mode"
import { attachMermaid } from "./mermaid"
import { attachSearch } from "./search"

document.addEventListener("DOMContentLoaded", () => {
  attachSearch()
  attachAIButtons()
  attachDarkMode()
  void attachMermaid()
})
