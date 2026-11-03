import { routeUrl } from "../../core/router"
import type { NavNode } from "../../core/types"

type NavProps = {
  tree: NavNode[]
  /** Route path of the page being rendered. Its link gets `aria-current="page"`. */
  currentPath: string
  basePath: string
}

/** Render the sidebar navigation tree. Nodes without a path render as plain labels. */
export function Nav({ tree, currentPath, basePath }: NavProps) {
  return (
    <nav class="aid-nav" aria-label="Docs">
      <NavList nodes={tree} currentPath={currentPath} basePath={basePath} />
    </nav>
  )
}

function NavList({ nodes, currentPath, basePath }: Omit<NavProps, "tree"> & { nodes: NavNode[] }) {
  return (
    <ul class="aid-nav-list">
      {nodes.map((node) => (
        <NavItem
          key={node.path ?? node.label}
          node={node}
          currentPath={currentPath}
          basePath={basePath}
        />
      ))}
    </ul>
  )
}

function NavItem({ node, currentPath, basePath }: Omit<NavProps, "tree"> & { node: NavNode }) {
  const hasChildren = node.children !== undefined && node.children.length > 0
  return (
    <li class={hasChildren ? "aid-nav-item aid-nav-group" : "aid-nav-item"}>
      {node.path === undefined ? (
        <span class="aid-nav-label">{node.label}</span>
      ) : (
        <a
          class="aid-nav-link"
          href={routeUrl(node.path, basePath)}
          aria-current={node.path === currentPath ? "page" : undefined}
        >
          {node.label}
        </a>
      )}
      {hasChildren ? (
        <NavList nodes={node.children ?? []} currentPath={currentPath} basePath={basePath} />
      ) : null}
    </li>
  )
}
