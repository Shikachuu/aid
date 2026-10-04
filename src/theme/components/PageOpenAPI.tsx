import { RawHtml } from "../../jsx-runtime"
import { AIButton } from "./AIButton"

export type PageOpenApiProps = {
  title: string
  /** JSON-stringified OpenAPI 3.1 document. */
  specJson: string
  machineUrl: string
}

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

function escapeScriptJson(s: string): string {
  return s.replace(/<\//g, "<\\/")
}
