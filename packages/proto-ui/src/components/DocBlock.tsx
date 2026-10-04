import { renderDocMarkdown } from "./doc-markdown"

export type DocBlockProps = {
  /** Raw comment text — protobufjs has already stripped the comment markers. */
  raw: string | null
}

export const DocBlock = ({ raw }: DocBlockProps) =>
  raw ? (
    <div
      className="proto-doc"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: renderDocMarkdown escapes raw HTML in the comment.
      dangerouslySetInnerHTML={{ __html: renderDocMarkdown(raw) }}
    />
  ) : null
