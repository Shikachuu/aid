export { ProtoReference, type ProtoReferenceProps } from "./components/ProtoReference"
export {
  type UseProtoAstOptions,
  type UseProtoAstResult,
  useProtoAst,
} from "./hooks/useProtoAst"
export type {
  ProtoAst,
  ProtoEntity,
  ProtoEnum,
  ProtoEnumValue,
  ProtoField,
  ProtoMessage,
  ProtoOneOf,
  ProtoRpc,
  ProtoService,
  ProtoSyntax,
  ProtoTypeRef,
} from "./parser"
export { parseProto } from "./parser"
