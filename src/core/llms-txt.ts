import path from "node:path"
import { titleCase } from "../renderers/shared"
import type { AidConfig } from "./config"
import { exportPath } from "./router"
import type { BuildContext, RenderedPage } from "./types"

const BUNDLED_DEFAULT = `# {{name}}

> {{description}}

This documentation is available in machine-readable form. Append \`.md\` to a markdown route, \`.json\` to an OpenAPI route, or \`.proto\` to a Proto route to receive the parseable variant.

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
  group: string
  optional: boolean
}

/**
 * Generate the site-root `llms.txt` per llmstxt.org. The user supplies prose
 * via `<templatesDir>/llms.txt` with `{{name}}`, `{{description}}`,
 * `{{base_url}}`, `{{toc}}`, and `{{toc:optional}}` placeholders; aid fills in
 * the routing/TOC. A bundled default template is used when no override exists,
 * so the file is emitted zero-config.
 */
export async function buildLlmsTxt(ctx: BuildContext, pages: RenderedPage[]): Promise<string> {
  const template = await resolveTemplate(ctx)
  const entries = pages
    .toSorted((a, b) => (a.route.path < b.route.path ? -1 : 1))
    .map((page) => buildEntry(page, ctx.config))
  const grouped = Map.groupBy(
    entries.filter((e) => !e.optional),
    (e) => e.group,
  )
  const optional = entries.filter((e) => e.optional)

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
    group: groupLabelFor(page.route.path),
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

function groupLabelFor(routePath: string): string {
  const [first, ...rest] = routePath.split("/").filter(Boolean)
  return first && rest.length > 0 ? titleCase(first) : ROOT_GROUP
}

function compareGroups(a: string, b: string): number {
  if (a === ROOT_GROUP) {
    return -1
  }
  if (b === ROOT_GROUP) {
    return 1
  }
  return a < b ? -1 : a > b ? 1 : 0
}

function renderGroupedToc(groups: Map<string, Entry[]>): string {
  return [...groups.keys()]
    .sort(compareGroups)
    .map((key) => `## ${key}\n\n${(groups.get(key) ?? []).map(renderBullet).join("\n")}`)
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
