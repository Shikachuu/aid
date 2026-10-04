import { renderDocMarkdown } from "./doc-markdown"

type DocBlockProps = {
  /** Comment text without its comment markers, which protobufjs strips. */
  raw: string | null
}

/** Render a proto comment as markdown, or nothing when the comment is null or empty. */
export const DocBlock = ({ raw }: DocBlockProps) =>
  raw ? (
    <div
      className="proto-doc"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: renderDocMarkdown escapes raw HTML in the comment.
      dangerouslySetInnerHTML={{ __html: renderDocMarkdown(raw) }}
    />
  ) : null
