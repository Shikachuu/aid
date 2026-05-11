import { RawHtml } from "../../jsx-runtime"
import { AIButton } from "./AIButton"

export type PageMarkdownProps = {
  bodyHtml: string
  machineUrl: string
}

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
