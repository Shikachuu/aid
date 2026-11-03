import path from "node:path"
import type { AidConfig } from "./config"
import { exportPath } from "./router"
import type { BuildContext, NavNode, RenderedPage } from "./types"

const BUNDLED_DEFAULT = `# {{name}}

> {{description}}

This documentation is available in machine-readable form. Append \`.md\` to a markdown route, \`.json\` to an OpenAPI or JSON Schema route, or \`.proto\` to a Proto route to receive the parseable variant.

{{toc}}

## Optional

{{toc:optional}}
`

const TEMPLATE_FILENAME = "llms.txt"
const ROOT_GROUP = "Docs"
const PLACEHOLDER_RE = /\{\{([\w-]+)(?::([\w-]+))?\}\}/g

type Entry = {
  title: string
  description: string | undefined
  url: string
  optional: boolean
}

/**
 * Generate the site-root `llms.txt` per llmstxt.org. The user supplies prose
 * via `<templatesDir>/llms.txt` with `{{name}}`, `{{description}}`,
 * `{{base_url}}`, `{{toc}}`, and `{{toc:optional}}` placeholders; aid fills in
 * the routing/TOC. A bundled default template is used when no override exists,
 * so the file is emitted zero-config. Sections follow the sidebar: each
 * top-level nav group is one section with the group's label, and top-level
 * pages go under `Docs`, which comes first.
 */
export async function buildLlmsTxt(
  ctx: BuildContext,
  pages: RenderedPage[],
  nav: NavNode[],
): Promise<string> {
  const template = await resolveTemplate(ctx)
  const entryByPath = new Map(pages.map((p) => [p.route.path, buildEntry(p, ctx.config)]))
  const sections = new Map<string, Entry[]>([[ROOT_GROUP, []]])
  for (const node of nav) {
    const key = node.children && node.children.length > 0 ? node.label : ROOT_GROUP
    const entries = navPaths(node).flatMap((p) => entryByPath.get(p) ?? [])
    sections.set(key, [...(sections.get(key) ?? []), ...entries])
  }
  const all = [...sections.values()].flat()
  const grouped = new Map(
    [...sections].map(([key, entries]) => [key, entries.filter((e) => !e.optional)]),
  )
  const optional = all.filter((e) => e.optional)

  return renderTemplate(template, {
    name: ctx.config.name,
    description: ctx.config.description ?? "",
    base_url: ctx.config.base_url ?? "",
    toc: renderGroupedToc(grouped),
    "toc:optional": optional.map(renderBullet).join("\n"),
  })
}

async function resolveTemplate(ctx: BuildContext): Promise<string> {
  if (ctx.templatesDir === null) {
    return BUNDLED_DEFAULT
  }
  const file = Bun.file(path.join(ctx.templatesDir, TEMPLATE_FILENAME))
  if (!(await file.exists())) {
    return BUNDLED_DEFAULT
  }
  return await file.text()
}

function buildEntry(page: RenderedPage, config: AidConfig): Entry {
  return {
    title: page.searchTokens.title,
    description: page.description,
    url: machineUrlFor(page, config),
    optional: page.route.frontmatter?.llms === "optional",
  }
}

function machineUrlFor(page: RenderedPage, config: AidConfig): string {
  const withBase = path.posix.join(
    config.base_path,
    exportPath(page.route, page.exports[0]?.suffix ?? ""),
  )
  return config.base_url ? new URL(withBase, config.base_url).toString() : withBase
}

function navPaths(node: NavNode): string[] {
  return [
    ...(node.path === undefined ? [] : [node.path]),
    ...(node.children ?? []).flatMap(navPaths),
  ]
}

function renderGroupedToc(groups: Map<string, Entry[]>): string {
  return [...groups]
    .filter(([, entries]) => entries.length > 0)
    .map(([key, entries]) => `## ${key}\n\n${entries.map(renderBullet).join("\n")}`)
    .join("\n\n")
}

function renderBullet(e: Entry): string {
  const base = `- [${e.title}](${e.url})`
  return e.description ? `${base}: ${e.description}` : base
}

function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(PLACEHOLDER_RE, (_match, name: string, arg: string | undefined) => {
    const key = arg === undefined ? name : `${name}:${arg}`
    if (!(key in vars)) {
      throw new Error(`aid: unknown llms.txt placeholder "{{${key}}}"`)
    }
    return vars[key] as string
  })
}
