import { RawHtml } from "../../jsx-runtime"

type PageMarkdownProps = {
  bodyHtml: string
}

/** Render the article shell for a markdown page, capped at the prose line length. */
export function PageMarkdown({ bodyHtml }: PageMarkdownProps) {
  return (
    <article class="aid-page aid-page-markdown">
      <RawHtml html={bodyHtml} />
    </article>
  )
}
