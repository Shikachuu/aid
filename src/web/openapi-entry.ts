import { createApiReference } from "@scalar/api-reference"

/**
 * Dedicated entry for the Scalar `api-reference` runtime. Only pages that
 * actually render an OpenAPI spec load this bundle — prose-only pages skip
 * it entirely. The renderer embeds the normalized 3.1 spec as
 * `<script type="application/json" id="aid-openapi-spec">` next to a
 * `<div id="aid-openapi-mount">`; we read the JSON out of the script tag and
 * hand it to Scalar inline (no refetch). Theming flows through the existing
 * `.aid-page-openapi` CSS variable bridge, so we explicitly hide Scalar's
 * own dark-mode toggle to avoid fighting `DarkToggle.tsx`.
 */
const mount = document.getElementById("aid-openapi-mount")
const specEl = document.getElementById("aid-openapi-spec")
if (mount && specEl?.textContent) {
  createApiReference(mount, {
    content: JSON.parse(specEl.textContent),
    hideDarkModeToggle: true,
    agent: { disabled: true },
    hideSearch: true,
    layout: "modern",
  })
}
