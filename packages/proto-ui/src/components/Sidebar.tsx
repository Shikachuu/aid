import type { ProtoAst, ProtoEnum, ProtoMessage } from "../parser"

type SidebarProps = {
  ast: ProtoAst
  baseHref?: string
}

const withNested = (messages: ProtoMessage[]): ProtoMessage[] =>
  messages.flatMap((m) => [m, ...withNested(m.nestedMessages)])

export const Sidebar = ({ ast, baseHref = "" }: SidebarProps) => {
  const messages = withNested(ast.messages)
  const enums: ProtoEnum[] = [...ast.enums, ...messages.flatMap((m) => m.nestedEnums)]
  const prefix = ast.package ? `${ast.package}.` : ""
  const label = (fqn: string): string => (fqn.startsWith(prefix) ? fqn.slice(prefix.length) : fqn)

  return (
    <nav className="proto-sidebar" aria-label="Proto entity navigation">
      {(
        [
          ["Services", ast.services],
          ["Messages", messages],
          ["Enums", enums],
        ] as const
      )
        .filter(([, entities]) => entities.length > 0)
        .map(([group, entities]) => (
          <div key={group} className="proto-sidebar-group">
            <h3 className="proto-sidebar-group-label">{group}</h3>
            <ul className="proto-sidebar-list">
              {entities.map((e) => (
                <li key={e.fqn} className="proto-sidebar-item">
                  <a className="proto-sidebar-link" href={`${baseHref}#${e.fqn}`} title={e.fqn}>
                    {label(e.fqn)}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
    </nav>
  )
}
