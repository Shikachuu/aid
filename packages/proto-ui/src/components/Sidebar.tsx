import type { ProtoAst } from "../parser"

type SidebarProps = {
  ast: ProtoAst
  baseHref?: string
}

/** Render anchor links to every top-level service, message and enum, grouped by kind. */
export const Sidebar = ({ ast, baseHref = "" }: SidebarProps) => (
  <nav className="proto-sidebar" aria-label="Proto entity navigation">
    {(
      [
        ["Services", ast.services],
        ["Messages", ast.messages],
        ["Enums", ast.enums],
      ] as const
    )
      .filter(([, entities]) => entities.length > 0)
      .map(([label, entities]) => (
        <div key={label} className="proto-sidebar-group">
          <h3 className="proto-sidebar-group-label">{label}</h3>
          <ul className="proto-sidebar-list">
            {entities.map((e) => (
              <li key={e.fqn} className="proto-sidebar-item">
                <a className="proto-sidebar-link" href={`${baseHref}#${e.fqn}`} title={e.fqn}>
                  {e.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
  </nav>
)
