import { RawHtml } from "../../jsx-runtime"
import { AIButton } from "./AIButton"

type PageHtmlProps = {
  bodyHtml: string
  machineUrl: string
}

/**
 * Render the article shell for a raw-HTML page. The `aid-page-html` class lets themes style HTML
 * pages apart from markdown pages.
 */
export function PageHtml({ bodyHtml, machineUrl }: PageHtmlProps) {
  return (
    <article class="aid-page aid-page-html">
      <div class="aid-page-toolbar">
        <AIButton machineUrl={machineUrl} />
      </div>
      <RawHtml html={bodyHtml} />
    </article>
  )
}
