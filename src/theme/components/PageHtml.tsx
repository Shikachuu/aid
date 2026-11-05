import { RawHtml } from "../../jsx-runtime"

type PageHtmlProps = {
  bodyHtml: string
}

/**
 * Render the article shell for a raw-HTML page. The `aid-page-html` class lets themes style HTML
 * pages apart from markdown pages.
 */
export function PageHtml({ bodyHtml }: PageHtmlProps) {
  return (
    <article class="aid-page aid-page-html">
      <RawHtml html={bodyHtml} />
    </article>
  )
}
