import { renderSafeDocMarkdown } from "./doc-markdown"

type DocBlockProps = {
  markdown: string | null
}

export const DocBlock = ({ markdown }: DocBlockProps) =>
  markdown ? (
    <div
      className="proto-doc"
      dangerouslySetInnerHTML={{ __html: renderSafeDocMarkdown(markdown) }}
    />
  ) : null
