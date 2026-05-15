import type { ProtoTypeRef } from "../parser"

export type TypeRefProps = {
  reference: ProtoTypeRef
  baseHref?: string
}

const WKT_DOCS_BASE = "https://protobuf.dev/reference/protobuf/google.protobuf/"

const wellKnownSlug = (raw: string): string | null => {
  const match = raw.match(/^\.?google\.protobuf\.(\w+)$/)
  const slug = match?.[1]
  if (!slug) {
    return null
  }
  return slug.toLowerCase()
}

export const TypeRef = ({ reference, baseHref = "" }: TypeRefProps) => {
  if (reference.scalar) {
    return <span className="proto-type-scalar">{reference.raw}</span>
  }
  if (reference.fqn) {
    return (
      <a className="proto-type-link" href={`${baseHref}#${reference.fqn}`}>
        {reference.raw}
      </a>
    )
  }
  const wkt = wellKnownSlug(reference.raw)
  if (wkt) {
    return (
      <a
        className="proto-type-external"
        href={`${WKT_DOCS_BASE}#${wkt}`}
        target="_blank"
        rel="noreferrer noopener"
      >
        {reference.raw}
      </a>
    )
  }
  return <span className="proto-type-unresolved">{reference.raw}</span>
}
