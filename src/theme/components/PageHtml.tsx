import { RawHtml } from "../../jsx-runtime"
import { AIButton } from "./AIButton"

export type PageHtmlProps = {
  bodyHtml: string
  machineUrl: string
}

/**
 * Article shell for raw-HTML pages. Mirrors {@link PageMarkdown}: same toolbar
 * slot for the AI button, same `aid-page` outer class for layout/grid styles;
 * the `aid-page-html` variant exists so themes can target prose-from-HTML
 * pages differently from prose-from-markdown if they need to.
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
