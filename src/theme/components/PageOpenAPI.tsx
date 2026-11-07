import { RawHtml } from "../../jsx-runtime"
import { AIButton } from "./AIButton"

type PageOpenApiProps = {
  title: string
  /** JSON-stringified OpenAPI 3.1 document. */
  specJson: string
  machineUrl: string
}

/**
 * Render the OpenAPI page shell. The `aid-openapi` browser bundle reads the spec from
 * `#aid-openapi-spec` and mounts Scalar on `#aid-openapi-mount`.
 */
export function PageOpenAPI({ title, specJson, machineUrl }: PageOpenApiProps) {
  return (
    <article class="aid-page aid-page-openapi">
      <div class="aid-page-toolbar">
        <AIButton machineUrl={machineUrl} />
      </div>
      <h1>{title}</h1>
      <script type="application/json" id="aid-openapi-spec">
        <RawHtml html={escapeScriptJson(specJson)} />
      </script>
      <div id="aid-openapi-mount" />
    </article>
  )
}

/**
 * A `<` can only occur inside a JSON string, where `\u003c` means the same
 * thing, so escaping every one keeps `</script>` and `<!--` from ending or
 * changing the script element.
 */
function escapeScriptJson(s: string): string {
  return s
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")
}
