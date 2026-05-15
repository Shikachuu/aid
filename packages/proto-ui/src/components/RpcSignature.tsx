import type { ProtoRpc } from "../parser"
import { TypeRef } from "./TypeRef"

export type RpcSignatureProps = {
  rpc: ProtoRpc
  baseHref?: string
}

export const RpcSignature = ({ rpc, baseHref }: RpcSignatureProps) => (
  <code className="proto-rpc-signature">
    <span className="proto-rpc-keyword">rpc</span>{" "}
    <span className="proto-rpc-name">{rpc.name}</span>
    <span className="proto-rpc-punct">(</span>
    {rpc.clientStreaming ? <span className="proto-rpc-stream">stream </span> : null}
    <TypeRef reference={rpc.requestType} baseHref={baseHref} />
    <span className="proto-rpc-punct">)</span> <span className="proto-rpc-keyword">returns</span>{" "}
    <span className="proto-rpc-punct">(</span>
    {rpc.serverStreaming ? <span className="proto-rpc-stream">stream </span> : null}
    <TypeRef reference={rpc.responseType} baseHref={baseHref} />
    <span className="proto-rpc-punct">);</span>
  </code>
)
