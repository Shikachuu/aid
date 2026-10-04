import { createProtoReference } from "@aid/proto-ui/hydrate"

const mount = document.getElementById("aid-proto-mount")
const protoUrl = mount?.dataset.protoUrl
if (mount && protoUrl) {
  createProtoReference(mount, { protoUrl })
}
