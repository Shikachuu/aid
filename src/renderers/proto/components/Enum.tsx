import type { ProtoEnum } from "../parser"

export function Enum({ enumDef }: { enumDef: ProtoEnum }) {
  return (
    <section class="aid-proto-enum">
      <h3>{enumDef.name}</h3>
      {enumDef.comment ? <p class="aid-proto-comment">{enumDef.comment}</p> : null}
    </section>
  )
}
