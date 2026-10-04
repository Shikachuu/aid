import { RawHtml } from "../../jsx-runtime"
import { AIButton } from "./AIButton"

type PageMarkdownProps = {
  bodyHtml: string
  machineUrl: string
}

/** Render the article shell for a markdown page, capped at the prose line length. */
export function PageMarkdown({ bodyHtml, machineUrl }: PageMarkdownProps) {
  return (
    <article class="aid-page aid-page-markdown">
      <div class="aid-page-toolbar">
        <AIButton machineUrl={machineUrl} />
      </div>
      <RawHtml html={bodyHtml} />
    </article>
  )
}
