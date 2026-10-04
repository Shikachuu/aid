import type { NavNode } from "../../core/types"

/** Render the sidebar navigation tree. Nodes without a path render as plain labels. */
export function Nav({ tree }: { tree: NavNode[] }) {
  return (
    <nav class="aid-nav">
      <ul>
        {tree.map((node) => (
          <NavItem key={node.path ?? node.label} node={node} />
        ))}
      </ul>
    </nav>
  )
}

function NavItem({ node }: { node: NavNode }) {
  return (
    <li class="aid-nav-item">
      {node.path ? <a href={node.path}>{node.label}</a> : <span>{node.label}</span>}
      {node.children && node.children.length > 0 ? (
        <ul>
          {node.children.map((child) => (
            <NavItem key={child.path ?? child.label} node={child} />
          ))}
        </ul>
      ) : null}
    </li>
  )
}
