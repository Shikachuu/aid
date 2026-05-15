import { marked } from "marked"
import { useMemo } from "react"

export type DocBlockProps = {
  /** Raw comment text — protobufjs has already stripped the comment markers. */
  raw: string | null
}

export const DocBlock = ({ raw }: DocBlockProps) => {
  const html = useMemo(() => {
    if (!raw) {
      return null
    }
    return marked.parse(raw, { async: false }) as string
  }, [raw])

  if (!html) {
    return null
  }
  return (
    <div
      className="proto-doc"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: comments come from trusted .proto source files; v1 does not sanitize.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
