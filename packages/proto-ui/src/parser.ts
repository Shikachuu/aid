import protobuf from "protobufjs"

export type ProtoSyntax = "proto2" | "proto3" | "editions" | "unknown"

export type ProtoTypeRef = {
  /** Raw type name as written in the .proto source. */
  raw: string
  /** Resolved fully-qualified name (no leading dot) if a user-defined type, else null. */
  fqn: string | null
  /** Kind of the resolved target, when fqn is non-null. */
  targetKind: "message" | "enum" | null
  /** True when the type is a built-in scalar (int32, string, bytes, …). */
  scalar: boolean
}

export type ProtoField = {
  name: string
  number: number
  rule: "optional" | "required" | "repeated" | "singular"
  type: ProtoTypeRef
  /** Key type for `map<K, V>` fields; absent otherwise. */
  mapKey?: ProtoTypeRef
  comment: string | null
  deprecated: boolean
  /** Name of the enclosing oneof (excludes proto3 synthetic optional-wrappers). */
  oneofName?: string
}

export type ProtoOneOf = {
  name: string
  comment: string | null
  fieldNames: string[]
}

export type ProtoEnumValue = {
  name: string
  number: number
  comment: string | null
  deprecated: boolean
}

export type ProtoEnum = {
  kind: "enum"
  name: string
  fqn: string
  comment: string | null
  deprecated: boolean
  values: ProtoEnumValue[]
}

export type ProtoMessage = {
  kind: "message"
  name: string
  fqn: string
  comment: string | null
  deprecated: boolean
  fields: ProtoField[]
  oneofs: ProtoOneOf[]
  nestedMessages: ProtoMessage[]
  nestedEnums: ProtoEnum[]
}

export type ProtoRpc = {
  name: string
  comment: string | null
  deprecated: boolean
  requestType: ProtoTypeRef
  responseType: ProtoTypeRef
  clientStreaming: boolean
  serverStreaming: boolean
}

export type ProtoService = {
  kind: "service"
  name: string
  fqn: string
  comment: string | null
  deprecated: boolean
  rpcs: ProtoRpc[]
}

export type ProtoEntity = ProtoMessage | ProtoEnum | ProtoService

export type ProtoAst = {
  package: string | null
  packageLeadingComment: string | null
  syntax: ProtoSyntax
  imports: string[]
  messages: ProtoMessage[]
  enums: ProtoEnum[]
  services: ProtoService[]
  /** Cross-link resolution map: fully-qualified name (no leading dot) → entity. */
  byFqn: ReadonlyMap<string, ProtoEntity>
}

const PROTO_SCALARS = new Set([
  "double",
  "float",
  "int32",
  "uint32",
  "sint32",
  "fixed32",
  "sfixed32",
  "int64",
  "uint64",
  "sint64",
  "fixed64",
  "bool",
  "string",
  "bytes",
])

/**
 * Parse a `.proto` source string into an aggregated, UI-friendly AST.
 *
 * Uses `protobufjs.parse()` for tokenizing and `resolveAll()` for cross-type
 * resolution. Resolution failures (e.g. unresolved imports) are tolerated —
 * unresolved references emit `fqn: null` and the UI renders raw type names
 * without cross-links.
 */
export const parseProto = (source: string): ProtoAst => {
  const result = protobuf.parse(source, {
    keepCase: true,
    alternateCommentMode: true,
  })

  try {
    result.root.resolveAll()
  } catch {
    // resolveAll throws on unresolved imports / unknown extensions. The AST
    // is still useful — unresolved fields render without cross-links.
  }

  const syntax = detectSyntax(source)
  const byFqn = new Map<string, ProtoEntity>()
  const messages: ProtoMessage[] = []
  const enums: ProtoEnum[] = []
  const services: ProtoService[] = []

  walkNamespace(result.root, byFqn, messages, enums, services, syntax)

  return {
    package: result.package ?? null,
    packageLeadingComment: result.package ? findPackageLeadingComment(source) : null,
    syntax,
    imports: result.imports ?? [],
    messages,
    enums,
    services,
    byFqn,
  }
}

const walkNamespace = (
  ns: protobuf.NamespaceBase,
  byFqn: Map<string, ProtoEntity>,
  messages: ProtoMessage[],
  enums: ProtoEnum[],
  services: ProtoService[],
  syntax: ProtoSyntax,
): void => {
  for (const child of ns.nestedArray) {
    if (child instanceof protobuf.Type) {
      const msg = mapMessage(child, byFqn, syntax)
      messages.push(msg)
    } else if (child instanceof protobuf.Enum) {
      const e = mapEnum(child)
      byFqn.set(e.fqn, e)
      enums.push(e)
    } else if (child instanceof protobuf.Service) {
      const svc = mapService(child)
      byFqn.set(svc.fqn, svc)
      services.push(svc)
    } else if (isDescendable(child)) {
      walkNamespace(child, byFqn, messages, enums, services, syntax)
    }
  }
}

const isDescendable = (obj: protobuf.ReflectionObject): obj is protobuf.NamespaceBase =>
  "nestedArray" in obj && Array.isArray((obj as { nestedArray?: unknown }).nestedArray)

const mapMessage = (
  t: protobuf.Type,
  byFqn: Map<string, ProtoEntity>,
  syntax: ProtoSyntax,
): ProtoMessage => {
  const fields: ProtoField[] = t.fieldsArray.map((f) => mapField(f, syntax))

  const oneofs: ProtoOneOf[] = []
  for (const o of t.oneofsArray) {
    if (o.isProto3Optional) {
      continue
    }
    oneofs.push({
      name: o.name,
      comment: o.comment ?? null,
      fieldNames: o.oneof.slice(),
    })
  }

  const nestedMessages: ProtoMessage[] = []
  const nestedEnums: ProtoEnum[] = []
  for (const child of t.nestedArray) {
    if (child instanceof protobuf.Type) {
      nestedMessages.push(mapMessage(child, byFqn, syntax))
    } else if (child instanceof protobuf.Enum) {
      const e = mapEnum(child)
      byFqn.set(e.fqn, e)
      nestedEnums.push(e)
    }
  }

  const message: ProtoMessage = {
    kind: "message",
    name: t.name,
    fqn: stripLeadingDot(t.fullName),
    comment: t.comment ?? null,
    deprecated: optionFlag(t.options, "deprecated"),
    fields,
    oneofs,
    nestedMessages,
    nestedEnums,
  }
  byFqn.set(message.fqn, message)
  return message
}

const mapEnum = (e: protobuf.Enum): ProtoEnum => {
  const valueOptions = e.valuesOptions ?? {}
  const values: ProtoEnumValue[] = []
  for (const [name, number] of Object.entries(e.values)) {
    values.push({
      name,
      number,
      comment: e.comments?.[name] ?? null,
      deprecated: optionFlag(valueOptions[name], "deprecated"),
    })
  }
  return {
    kind: "enum",
    name: e.name,
    fqn: stripLeadingDot(e.fullName),
    comment: e.comment ?? null,
    deprecated: optionFlag(e.options, "deprecated"),
    values,
  }
}

const mapService = (s: protobuf.Service): ProtoService => ({
  kind: "service",
  name: s.name,
  fqn: stripLeadingDot(s.fullName),
  comment: s.comment ?? null,
  deprecated: optionFlag(s.options, "deprecated"),
  rpcs: s.methodsArray.map(mapMethod),
})

const mapMethod = (m: protobuf.Method): ProtoRpc => ({
  name: m.name,
  comment: m.comment ?? null,
  deprecated: optionFlag(m.options, "deprecated"),
  requestType: makeTypeRef(m.requestType, m.resolvedRequestType),
  responseType: makeTypeRef(m.responseType, m.resolvedResponseType),
  clientStreaming: m.requestStream === true,
  serverStreaming: m.responseStream === true,
})

const mapField = (f: protobuf.FieldBase, syntax: ProtoSyntax): ProtoField => {
  const isMap = f instanceof protobuf.MapField
  const mapKey = isMap ? makeTypeRef(f.keyType, null) : undefined

  return {
    name: f.name,
    number: f.id,
    rule: detectRule(f, syntax, isMap),
    type: makeTypeRef(f.type, f.resolvedType),
    mapKey,
    comment: f.comment ?? null,
    deprecated: optionFlag(f.options, "deprecated"),
    oneofName: f.partOf && !f.partOf.isProto3Optional ? f.partOf.name : undefined,
  }
}

const detectRule = (
  f: protobuf.FieldBase,
  syntax: ProtoSyntax,
  isMap: boolean,
): ProtoField["rule"] => {
  if (isMap) {
    return "singular"
  }
  if (f.repeated) {
    return "repeated"
  }
  if (f instanceof protobuf.Field) {
    if (f.required) {
      return "required"
    }
    if (syntax === "proto3" && f.partOf?.isProto3Optional) {
      return "optional"
    }
    if (syntax === "proto2") {
      return "optional"
    }
  }
  return "singular"
}

const makeTypeRef = (raw: string, resolved: protobuf.ReflectionObject | null): ProtoTypeRef => {
  if (PROTO_SCALARS.has(raw)) {
    return { raw, fqn: null, targetKind: null, scalar: true }
  }
  if (resolved) {
    const fqn = stripLeadingDot(resolved.fullName)
    const targetKind: ProtoTypeRef["targetKind"] =
      resolved instanceof protobuf.Enum ? "enum" : "message"
    return { raw, fqn, targetKind, scalar: false }
  }
  return { raw, fqn: null, targetKind: null, scalar: false }
}

const stripLeadingDot = (fqn: string): string => (fqn.startsWith(".") ? fqn.slice(1) : fqn)

const optionFlag = (options: Record<string, unknown> | undefined, name: string): boolean => {
  if (!options) {
    return false
  }
  const v = options[name]
  return v === true || v === "true"
}

const detectSyntax = (source: string): ProtoSyntax => {
  const syntaxMatch = source.match(/^\s*syntax\s*=\s*"([^"]+)"/m)
  if (syntaxMatch?.[1] === "proto2") {
    return "proto2"
  }
  if (syntaxMatch?.[1] === "proto3") {
    return "proto3"
  }
  if (/^\s*edition\s*=/m.test(source)) {
    return "editions"
  }
  return "unknown"
}

const findPackageLeadingComment = (source: string): string | null => {
  const pkgIndex = source.search(/^\s*package\s+/m)
  if (pkgIndex === -1) {
    return null
  }

  const before = source.slice(0, pkgIndex)
  const lines = before.split(/\r?\n/)

  const collected: string[] = []
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = (lines[i] ?? "").trim()
    if (line === "") {
      if (collected.length > 0) {
        break
      }
      continue
    }
    if (line.startsWith("//")) {
      collected.unshift(line.replace(/^\/\/\s?/, ""))
    } else {
      break
    }
  }

  return collected.length > 0 ? collected.join("\n") : null
}
