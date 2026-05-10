import { RawHtml } from "../../jsx-runtime"
import { AIButton } from "./AIButton"

export type PageMarkdownProps = {
  title: string
  bodyHtml: string
  machineUrl: string
}

export function PageMarkdown({ title, bodyHtml, machineUrl }: PageMarkdownProps) {
  return (
    <article class="aid-page aid-page-markdown">
      <div class="aid-page-toolbar">
        <AIButton machineUrl={machineUrl} />
      </div>
      <h1>{title}</h1>
      <RawHtml html={bodyHtml} />
    </article>
  )
}
