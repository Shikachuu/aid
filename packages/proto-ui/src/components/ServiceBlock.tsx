import type { ProtoService } from "../parser"
import { DeprecatedBadge } from "./DeprecatedBadge"
import { DocBlock } from "./DocBlock"
import { EntityHeader } from "./EntityHeader"
import { printService } from "./print-proto"
import { RpcSignature } from "./RpcSignature"
import { ViewSource } from "./ViewSource"

type ServiceBlockProps = {
  service: ProtoService
  baseHref?: string
}

/** Render a service with its RPCs. Each RPC gets the anchor id `{serviceFqn}.{rpcName}`. */
export const ServiceBlock = ({ service, baseHref }: ServiceBlockProps) => (
  <section className="proto-service">
    <EntityHeader
      kind="service"
      name={service.name}
      fqn={service.fqn}
      deprecated={service.deprecated}
    />
    <DocBlock raw={service.comment} />
    <ul className="proto-rpc-list">
      {service.rpcs.map((rpc) => (
        <li key={rpc.name} className="proto-rpc-item" id={`${service.fqn}.${rpc.name}`}>
          <RpcSignature rpc={rpc} baseHref={baseHref} />
          {rpc.deprecated ? (
            <>
              {" "}
              <DeprecatedBadge />
            </>
          ) : null}
          <DocBlock raw={rpc.comment} />
        </li>
      ))}
    </ul>
    <ViewSource declaration={printService(service)} />
  </section>
)
