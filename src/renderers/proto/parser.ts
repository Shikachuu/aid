export type ProtoAst = {
  package?: string
  syntax: "proto2" | "proto3" | "editions"
  imports: string[]
  messages: ProtoMessage[]
  enums: ProtoEnum[]
  services: ProtoService[]
}

export type ProtoMessage = {
  name: string
  fields: ProtoField[]
  nested: ProtoMessage[]
  comment?: string
}

export type ProtoField = {
  name: string
  number: number
  type: string
  rule: "optional" | "required" | "repeated"
  comment?: string
}

export type ProtoEnum = {
  name: string
  values: { name: string; number: number; comment?: string }[]
  comment?: string
}

export type ProtoService = {
  name: string
  rpcs: ProtoRpc[]
  comment?: string
}

export type ProtoRpc = {
  name: string
  input: string
  output: string
  clientStreaming: boolean
  serverStreaming: boolean
  comment?: string
}

/**
 * Parse `.proto` source into a simplified AST that the TSX components consume.
 * Backed by protobufjs's `parse` (source-level) which preserves comments.
 *
 * Stub.
 */
export function parseProto(_source: string): ProtoAst {
  throw new Error("parseProto(): not implemented")
}
