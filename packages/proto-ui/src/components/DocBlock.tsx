import { renderDocMarkdown } from "./doc-markdown"

type DocBlockProps = {
  /** Comment text without its comment markers, which protobufjs strips. */
  raw: string | null
}

export const DocBlock = ({ raw }: DocBlockProps) =>
  raw ? (
    <div className="proto-doc" dangerouslySetInnerHTML={{ __html: renderDocMarkdown(raw) }} />
  ) : null
