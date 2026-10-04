import { createProtoReference } from "@aid/proto-ui/hydrate"

/**
 * Dedicated entry for `@aid/proto-ui`. Only proto pages load this bundle — prose
 * and OpenAPI pages skip it entirely. The renderer emits an
 * `<div id="aid-proto-mount" data-proto-url="...">` adjacent to the `.proto`
 * sibling export; we read the URL, fetch the source via the React component's
 * built-in fetch lifecycle, and render the documentation client-side.
 */
const mount = document.getElementById("aid-proto-mount")
const protoUrl = mount?.dataset.protoUrl
if (mount && protoUrl) {
  createProtoReference(mount, { protoUrl })
}
