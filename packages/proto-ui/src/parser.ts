import protobuf from "protobufjs"

/** The `syntax` or `edition` the file declares. `unknown` means it declares neither. */
export type ProtoSyntax = "proto2" | "proto3" | "editions" | "unknown"

export type ProtoTypeRef = {
  raw: string
  /** Resolved fully-qualified name (no leading dot) if a user-defined type, else null. */
  fqn: string | null
  scalar: boolean
}

export type ProtoField = {
  name: string
  number: number
  /**
   * `singular` means the field has no label, as in proto3 fields without `optional` and map fields.
   */
  rule: "optional" | "required" | "repeated" | "singular"
  type: ProtoTypeRef
  /** Key type for `map<K, V>` fields; absent otherwise. */
  mapKey?: ProtoTypeRef
  comment: string | null
  deprecated: boolean
  /** Name of the enclosing oneof (excludes proto3 synthetic optional-wrappers). */
  oneofName?: string
}

/** A oneof group. Its member fields are the message fields with a matching `oneofName`. */
export type ProtoOneOf = {
  name: string
  comment: string | null
}

export type ProtoEnumValue = {
  name: string
  number: number
  comment: string | null
  deprecated: boolean
}

/** An enum. `fqn` has no leading dot and is the anchor id on the rendered page. */
export type ProtoEnum = {
  kind: "enum"
  name: string
  fqn: string
  comment: string | null
  deprecated: boolean
  values: ProtoEnumValue[]
}

/**
 * A message with its nested messages and enums. `fqn` has no leading dot and is the anchor id on
 * the rendered page.
 */
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

/** A service. `fqn` has no leading dot and is the anchor id on the rendered page. */
export type ProtoService = {
  kind: "service"
  name: string
  fqn: string
  comment: string | null
  deprecated: boolean
  rpcs: ProtoRpc[]
}

/**
 * One parsed `.proto` file. Each list holds only top-level entities; nested ones live on their
 * parent message.
 */
export type ProtoAst = {
  package: string | null
  packageLeadingComment: string | null
  syntax: ProtoSyntax
  messages: ProtoMessage[]
  enums: ProtoEnum[]
  services: ProtoService[]
}

const isScalar = (raw: string): boolean => Object.hasOwn(protobuf.types.basic, raw)

/**
 * Parse `.proto` source into a {@link ProtoAst}. Throws on syntax errors. A reference that does not
 * resolve, for example to a type from an import, gets `fqn: null`; every other reference still
 * resolves.
 */
export const parseProto = (source: string): ProtoAst => {
  let result: protobuf.IParserResult
  try {
    result = protobuf.parse(source, { keepCase: true, alternateCommentMode: true })
  } catch (err) {
    throw withNestingLine(err, source)
  }

  resolveFeatures(result.root)
  resolveEach(result.root)

  const syntax = detectSyntax(source)
  const messages: ProtoMessage[] = []
  const enums: ProtoEnum[] = []
  const services: ProtoService[] = []

  walkNamespace(result.root, messages, enums, services, syntax)

  return {
    package: result.package ?? null,
    packageLeadingComment: result.package ? findPackageLeadingComment(source) : null,
    syntax,
    messages,
    enums,
    services,
  }
}

/**
 * Resolve each field and method reference on its own. `Root#resolveAll` stops at the first
 * reference it cannot resolve and leaves every later one unresolved.
 */
const resolveEach = (ns: protobuf.NamespaceBase): void => {
  for (const child of ns.nestedArray) {
    if (child instanceof protobuf.Type) {
      for (const field of child.fieldsArray) {
        tryResolve(field)
      }
    } else if (child instanceof protobuf.Service) {
      for (const method of child.methodsArray) {
        tryResolve(method)
      }
    }
    if (child instanceof protobuf.Namespace || child instanceof protobuf.Type) {
      resolveEach(child)
    }
  }
}

type FeatureResolvable = {
  _edition?: string | null
  _resolveFeaturesRecursive?: (edition: string | null | undefined) => void
}

/**
 * Editions presence and `LEGACY_REQUIRED` come from resolved features, which protobufjs only
 * computes inside `resolveAll`. The per-reference resolution skips `resolveAll`, so run the
 * feature step on its own.
 */
const resolveFeatures = (root: protobuf.Root): void => {
  const target = root as unknown as FeatureResolvable
  target._resolveFeaturesRecursive?.(target._edition)
}

const tryResolve = (obj: protobuf.ReflectionObject): void => {
  try {
    obj.resolve()
  } catch {
    return
  }
}

/** protobufjs reports `max depth exceeded` without a position, so add the line where it happens. */
const withNestingLine = (err: unknown, source: string): unknown => {
  if (!(err instanceof Error) || err.message !== "max depth exceeded") {
    return err
  }
  const limit = protobuf.util.nestingLimit
  const code = blankComments(source)
  let depth = 0
  let line = 1
  for (const char of code) {
    if (char === "\n") {
      line++
    } else if (char === "{") {
      depth++
      if (depth > limit) {
        return new Error(
          `max depth exceeded: declarations nest deeper than ${limit} (line ${line})`,
          {
            cause: err,
          },
        )
      }
    } else if (char === "}") {
      depth--
    }
  }
  return err
}

const COMMENT_OR_STRING = /\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g

const blankComments = (source: string): string =>
  source.replace(COMMENT_OR_STRING, (match) =>
    match.startsWith("/") ? match.replace(/[^\r\n]/g, " ") : match,
  )

/** Drop the `!` of `//!` comments, which protobufjs keeps. */
const docComment = (comment: string | null | undefined): string | null => {
  if (comment == null) {
    return null
  }
  const lines = comment.split("\n")
  return lines.every((line) => line === "" || /^!(?:\s|$)/.test(line))
    ? lines.map((line) => line.replace(/^! ?/, "")).join("\n")
    : comment
}

const walkNamespace = (
  ns: protobuf.NamespaceBase,
  messages: ProtoMessage[],
  enums: ProtoEnum[],
  services: ProtoService[],
  syntax: ProtoSyntax,
): void => {
  for (const child of ns.nestedArray) {
    if (child instanceof protobuf.Type) {
      messages.push(mapMessage(child, syntax))
    } else if (child instanceof protobuf.Enum) {
      enums.push(mapEnum(child))
    } else if (child instanceof protobuf.Service) {
      services.push(mapService(child))
    } else if (child instanceof protobuf.Namespace) {
      walkNamespace(child, messages, enums, services, syntax)
    }
  }
}

const mapMessage = (t: protobuf.Type, syntax: ProtoSyntax): ProtoMessage => {
  const fields: ProtoField[] = t.fieldsArray
    .filter((f) => !f.declaringField)
    .map((f) => mapField(f, syntax))

  const oneofs: ProtoOneOf[] = []
  for (const o of t.oneofsArray) {
    if (o.isProto3Optional) {
      continue
    }
    oneofs.push({ name: o.name, comment: docComment(o.comment) })
  }

  const nestedMessages: ProtoMessage[] = []
  const nestedEnums: ProtoEnum[] = []
  for (const child of t.nestedArray) {
    if (child instanceof protobuf.Type) {
      nestedMessages.push(mapMessage(child, syntax))
    } else if (child instanceof protobuf.Enum) {
      nestedEnums.push(mapEnum(child))
    }
  }

  return {
    kind: "message",
    name: t.name,
    fqn: stripLeadingDot(t.fullName),
    comment: docComment(t.comment),
    deprecated: optionFlag(t.options, "deprecated"),
    fields,
    oneofs,
    nestedMessages,
    nestedEnums,
  }
}

const mapEnum = (e: protobuf.Enum): ProtoEnum => {
  const valueOptions = e.valuesOptions ?? {}
  const values: ProtoEnumValue[] = []
  for (const [name, number] of Object.entries(e.values)) {
    values.push({
      name,
      number,
      comment: docComment(e.comments?.[name]),
      deprecated: optionFlag(valueOptions[name], "deprecated"),
    })
  }
  return {
    kind: "enum",
    name: e.name,
    fqn: stripLeadingDot(e.fullName),
    comment: docComment(e.comment),
    deprecated: optionFlag(e.options, "deprecated"),
    values,
  }
}

const mapService = (s: protobuf.Service): ProtoService => ({
  kind: "service",
  name: s.name,
  fqn: stripLeadingDot(s.fullName),
  comment: docComment(s.comment),
  deprecated: optionFlag(s.options, "deprecated"),
  rpcs: s.methodsArray.map(mapMethod),
})

const mapMethod = (m: protobuf.Method): ProtoRpc => ({
  name: m.name,
  comment: docComment(m.comment),
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
    comment: docComment(f.comment),
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
    if (f.partOf?.isProto3Optional) {
      return "optional"
    }
    if (syntax === "proto2") {
      return "optional"
    }
    if (syntax === "editions" && f.hasPresence) {
      return "optional"
    }
  }
  return "singular"
}

const makeTypeRef = (raw: string, resolved: protobuf.ReflectionObject | null): ProtoTypeRef => {
  if (isScalar(raw)) {
    return { raw, fqn: null, scalar: true }
  }
  return { raw, fqn: resolved ? stripLeadingDot(resolved.fullName) : null, scalar: false }
}

const stripLeadingDot = (fqn: string): string => (fqn.startsWith(".") ? fqn.slice(1) : fqn)

const optionFlag = (options: Record<string, unknown> | undefined, name: string): boolean =>
  options?.[name] === true || options?.[name] === "true"

const detectSyntax = (source: string): ProtoSyntax => {
  const code = blankComments(source)
  const declared = code.match(/^\s*syntax\s*=\s*["']([^"']+)["']/m)?.[1]
  if (declared === "proto2" || declared === "proto3") {
    return declared
  }
  if (/^\s*edition\s*=/m.test(code)) {
    return "editions"
  }
  return declared === undefined ? "proto2" : "unknown"
}

const findPackageLeadingComment = (source: string): string | null => {
  const pkgIndex = blankComments(source).search(/^[ \t]*package\s/m)
  if (pkgIndex === -1) {
    return null
  }

  const lines = source.slice(0, pkgIndex).split(/\r?\n/)
  lines.pop()
  if ((lines.at(-1) ?? "").trim().endsWith("*/")) {
    return blockCommentText(lines.join("\n").trimEnd())
  }

  const collected: string[] = []
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = (lines[i] ?? "").trim()
    if (!line.startsWith("//")) {
      break
    }
    collected.unshift(line.replace(/^\/\/[/!]?\s?/, ""))
  }

  return collected.length > 0 ? collected.join("\n") : null
}

const blockCommentText = (before: string): string | null => {
  const last = [...before.matchAll(COMMENT_OR_STRING)].at(-1)
  if (!last || !last[0].startsWith("/*") || last.index + last[0].length !== before.length) {
    return null
  }
  const lines = last[0]
    .slice(2, -2)
    .replace(/^\*/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
  const starred = lines.every((line) => line === "" || line.startsWith("*"))
  const text = lines
    .map((line) => (starred ? line.replace(/^\*\s?/, "") : line))
    .join("\n")
    .trim()
  return text === "" ? null : text
}
