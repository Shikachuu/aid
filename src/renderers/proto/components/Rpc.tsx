import type { ProtoRpc } from "../parser"

export function Rpc({ rpc }: { rpc: ProtoRpc }) {
  return (
    <div class="aid-proto-rpc">
      <code>
        rpc {rpc.name}({rpc.clientStreaming ? "stream " : ""}
        {rpc.input}) returns ({rpc.serverStreaming ? "stream " : ""}
        {rpc.output})
      </code>
    </div>
  )
}
