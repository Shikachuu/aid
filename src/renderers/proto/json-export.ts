import type { ProtoAst } from "./parser"

/**
 * Convert the proto AST into a stable JSON shape for the `.json` side-channel
 * export. Stub.
 */
export function protoToJson(ast: ProtoAst): string {
  return JSON.stringify(ast, null, 2)
}
