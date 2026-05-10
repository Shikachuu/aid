import { ProtoPage } from "../../renderers/proto/components/ProtoPage"
import type { ProtoAst } from "../../renderers/proto/parser"
import { AIButton } from "./AIButton"

export type PageProtoProps = {
  title: string
  ast: ProtoAst
  machineUrl: string
}

export function PageProto({ title, ast, machineUrl }: PageProtoProps) {
  return (
    <article class="aid-page aid-page-proto">
      <div class="aid-page-toolbar">
        <AIButton machineUrl={machineUrl} />
      </div>
      <h1>{title}</h1>
      <ProtoPage ast={ast} />
    </article>
  )
}
