import type { ProtoService } from "../parser"
import { DeprecatedBadge } from "./DeprecatedBadge"
import { DocBlock } from "./DocBlock"
import { EntityHeader } from "./EntityHeader"
import { DeclarationSummary } from "./DeclarationSummary"
import { RpcSignature } from "./RpcSignature"
import { summarizeService } from "./summarize-proto"

type ServiceBlockProps = {
  service: ProtoService
  baseHref?: string
}

export const ServiceBlock = ({ service, baseHref }: ServiceBlockProps) => (
  <section className="proto-service">
    <EntityHeader
      kind="service"
      name={service.name}
      fqn={service.fqn}
      deprecated={service.deprecated}
    />
    <DocBlock markdown={service.comment} />
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
          <DocBlock markdown={rpc.comment} />
        </li>
      ))}
    </ul>
    <DeclarationSummary declaration={summarizeService(service)} />
  </section>
)
