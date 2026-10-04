import type { ProtoEnum, ProtoMessage, ProtoService } from "../parser"

const indent = (text: string, level: number): string => {
  const pad = "  ".repeat(level)
  return text
    .split("\n")
    .map((line) => (line.length > 0 ? `${pad}${line}` : line))
    .join("\n")
}

const rulePrefix = (rule: ProtoMessage["fields"][number]["rule"]): string =>
  rule === "singular" ? "" : `${rule} `

/**
 * Reconstruct a `.proto`-style declaration for a single entity. Lossy by design —
 * options, reserved ranges, and custom annotations are dropped. Used by `<ViewSource/>`
 * as a quick reference; the authoritative source is the original `.proto` file.
 */
export const printMessage = (m: ProtoMessage): string => {
  const lines: string[] = [`message ${m.name} {`]
  for (const f of m.fields.filter((f) => !f.oneofName)) {
    if (f.mapKey) {
      lines.push(`  map<${f.mapKey.raw}, ${f.type.raw}> ${f.name} = ${f.number};`)
    } else {
      lines.push(`  ${rulePrefix(f.rule)}${f.type.raw} ${f.name} = ${f.number};`)
    }
  }
  for (const o of m.oneofs) {
    lines.push(`  oneof ${o.name} {`)
    for (const f of m.fields.filter((f) => f.oneofName === o.name)) {
      lines.push(`    ${f.type.raw} ${f.name} = ${f.number};`)
    }
    lines.push("  }")
  }
  for (const nm of m.nestedMessages) {
    lines.push("")
    lines.push(indent(printMessage(nm), 1))
  }
  for (const ne of m.nestedEnums) {
    lines.push("")
    lines.push(indent(printEnum(ne), 1))
  }
  lines.push("}")
  return lines.join("\n")
}

export const printEnum = (e: ProtoEnum): string => {
  const lines: string[] = [`enum ${e.name} {`]
  for (const v of e.values) {
    lines.push(`  ${v.name} = ${v.number};`)
  }
  lines.push("}")
  return lines.join("\n")
}

export const printService = (s: ProtoService): string => {
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
