import type { NavNode } from "../../core/types"

export function PageIndex({ title, children }: { title: string; children: NavNode[] }) {
  return (
    <article class="aid-page aid-page-index">
      <h1>{title}</h1>
      <ul>
        {children.map((c) => (
          <li>{c.path ? <a href={c.path}>{c.label}</a> : <span>{c.label}</span>}</li>
        ))}
      </ul>
    </article>
  )
}
