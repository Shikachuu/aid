import type { ProtoTypeRef } from "../parser"

type TypeRefProps = {
  reference: ProtoTypeRef
  baseHref?: string
}

const WKT_DOCS_BASE = "https://protobuf.dev/reference/protobuf/google.protobuf/"

/**
 * Render a field or RPC type. Resolved types link to their anchor on the page, and well-known
 * `google.protobuf` types link to protobuf.dev.
 */
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
  const wkt = /^\.?google\.protobuf\.(\w+)$/.exec(reference.raw)?.[1]?.toLowerCase()
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
