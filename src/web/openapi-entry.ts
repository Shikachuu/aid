import { createApiReference } from "@scalar/api-reference"

const mount = document.getElementById("aid-openapi-mount")
const specEl = document.getElementById("aid-openapi-spec")
if (mount && specEl?.textContent) {
  createApiReference(mount, {
    content: JSON.parse(specEl.textContent),
    hideDarkModeToggle: true,
    agent: { disabled: true },
    hideSearch: true,
    showDeveloperTools: "never",
    layout: "modern",
  })
}
