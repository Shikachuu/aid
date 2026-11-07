import type { ProtoEnum, ProtoField, ProtoMessage, ProtoService, ProtoSyntax } from "../parser"

const indent = (text: string, level: number): string => {
  const pad = "  ".repeat(level)
  return text
    .split("\n")
    .map((line) => (line.length > 0 ? `${pad}${line}` : line))
    .join("\n")
}

const EDITIONS_PRESENCE: Partial<Record<ProtoField["rule"], string>> = {
  required: "LEGACY_REQUIRED",
  singular: "IMPLICIT",
}

const summarizeField = (f: ProtoField, syntax: ProtoSyntax, inOneof: boolean): string => {
  const type = f.mapKey ? `map<${f.mapKey.raw}, ${f.type.raw}>` : f.type.raw
  const declaration = `${type} ${f.name} = ${f.number}`
  if (inOneof || f.mapKey) {
    return `${declaration};`
  }
  if (f.rule === "repeated") {
    return `repeated ${declaration};`
  }
  if (syntax === "editions") {
    const presence = EDITIONS_PRESENCE[f.rule]
    return presence ? `${declaration} [features.field_presence = ${presence}];` : `${declaration};`
  }
  return f.rule === "singular" ? `${declaration};` : `${f.rule} ${declaration};`
}

export const summarizeMessage = (m: ProtoMessage, syntax: ProtoSyntax): string => {
  const lines: string[] = [`message ${m.name} {`]
  for (const f of m.fields.filter((f) => !f.oneofName)) {
    lines.push(`  ${summarizeField(f, syntax, false)}`)
  }
  for (const o of m.oneofs) {
    lines.push(`  oneof ${o.name} {`)
    for (const f of m.fields.filter((f) => f.oneofName === o.name)) {
      lines.push(`    ${summarizeField(f, syntax, true)}`)
    }
    lines.push("  }")
  }
  for (const nm of m.nestedMessages) {
    lines.push("")
    lines.push(indent(summarizeMessage(nm, syntax), 1))
  }
  for (const ne of m.nestedEnums) {
    lines.push("")
    lines.push(indent(summarizeEnum(ne), 1))
  }
  lines.push("}")
  return lines.join("\n")
}

export const summarizeEnum = (e: ProtoEnum): string => {
  const lines: string[] = [`enum ${e.name} {`]
  if (new Set(e.values.map((v) => v.number)).size < e.values.length) {
    lines.push("  option allow_alias = true;")
  }
  for (const v of e.values) {
    lines.push(`  ${v.name} = ${v.number};`)
  }
  lines.push("}")
  return lines.join("\n")
}

export const summarizeService = (s: ProtoService): string => {
  const lines: string[] = [`service ${s.name} {`]
  for (const rpc of s.rpcs) {
    const reqStream = rpc.clientStreaming ? "stream " : ""
    const resStream = rpc.serverStreaming ? "stream " : ""
    lines.push(
      `  rpc ${rpc.name}(${reqStream}${rpc.requestType.raw}) returns (${resStream}${rpc.responseType.raw});`,
    )
  }
  lines.push("}")
  return lines.join("\n")
}
