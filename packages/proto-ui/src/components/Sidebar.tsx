import type { ProtoAst } from "../parser"

export type SidebarProps = {
  ast: ProtoAst
  baseHref?: string
}

export const Sidebar = ({ ast, baseHref = "" }: SidebarProps) => (
  <nav className="proto-sidebar" aria-label="Proto entity navigation">
    {ast.services.length > 0 ? (
      <SidebarGroup label="Services">
        {ast.services.map((s) => (
          <SidebarLink key={s.fqn} href={`${baseHref}#${s.fqn}`} fqn={s.fqn} label={s.name} />
        ))}
      </SidebarGroup>
    ) : null}
    {ast.messages.length > 0 ? (
      <SidebarGroup label="Messages">
        {ast.messages.map((m) => (
          <SidebarLink key={m.fqn} href={`${baseHref}#${m.fqn}`} fqn={m.fqn} label={m.name} />
        ))}
      </SidebarGroup>
    ) : null}
    {ast.enums.length > 0 ? (
      <SidebarGroup label="Enums">
        {ast.enums.map((e) => (
          <SidebarLink key={e.fqn} href={`${baseHref}#${e.fqn}`} fqn={e.fqn} label={e.name} />
        ))}
      </SidebarGroup>
    ) : null}
  </nav>
)

type SidebarGroupProps = {
  label: string
  children: React.ReactNode
}

const SidebarGroup = ({ label, children }: SidebarGroupProps) => (
  <div className="proto-sidebar-group">
    <h3 className="proto-sidebar-group-label">{label}</h3>
    <ul className="proto-sidebar-list">{children}</ul>
  </div>
)

type SidebarLinkProps = {
  href: string
  fqn: string
  label: string
}

const SidebarLink = ({ href, fqn, label }: SidebarLinkProps) => (
  <li className="proto-sidebar-item">
    <a className="proto-sidebar-link" href={href} title={fqn}>
      {label}
    </a>
  </li>
)
