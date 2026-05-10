import type { ProtoService } from "../parser"

export function Service({ service }: { service: ProtoService }) {
  return (
    <section class="aid-proto-service">
      <h3>{service.name}</h3>
      {service.comment ? <p class="aid-proto-comment">{service.comment}</p> : null}
    </section>
  )
}
