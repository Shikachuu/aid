import type { ProtoAst } from "../parser"

export function ProtoPage({ ast }: { ast: ProtoAst }) {
  return (
    <article class="aid-proto">
      <header>
        {ast.package ? <p class="aid-proto-package">package {ast.package}</p> : null}
        <p class="aid-proto-syntax">syntax = "{ast.syntax}"</p>
      </header>
      {/* Messages, enums, services land in their own components in the renderer PR. */}
    </article>
  )
}
