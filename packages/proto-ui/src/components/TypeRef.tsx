import type { ProtoTypeRef } from "../parser"

type TypeRefProps = {
  reference: ProtoTypeRef
  baseHref?: string
}

const WKT_DOCS_BASE = "https://protobuf.dev/reference/protobuf/google.protobuf/"

const WELL_KNOWN_TYPES = new Set([
  "Any",
  "Api",
  "BoolValue",
  "BytesValue",
  "DoubleValue",
  "Duration",
  "Empty",
  "Enum",
  "EnumValue",
  "Field",
  "FieldMask",
  "FloatValue",
  "Int32Value",
  "Int64Value",
  "ListValue",
  "Method",
  "Mixin",
  "NullValue",
  "Option",
  "SourceContext",
  "StringValue",
  "Struct",
  "Syntax",
  "Timestamp",
  "Type",
  "UInt32Value",
  "UInt64Value",
  "Value",
])

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
  const wkt = /^\.?google\.protobuf\.(\w+)$/.exec(reference.raw)?.[1]
  if (wkt && WELL_KNOWN_TYPES.has(wkt)) {
    return (
      <a
        className="proto-type-external"
        href={`${WKT_DOCS_BASE}#${wkt.toLowerCase()}`}
        target="_blank"
        rel="noreferrer noopener"
      >
        {reference.raw}
      </a>
    )
  }
  return <span className="proto-type-unresolved">{reference.raw}</span>
}
