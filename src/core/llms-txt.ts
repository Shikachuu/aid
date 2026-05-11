import path from "node:path"
import type { AidConfig } from "./config"
import type { BuildContext, RenderedPage, Route } from "./types"

const BUNDLED_DEFAULT = `# {{name}}

> {{description}}

This documentation is available in machine-readable form. Append \`.md\` to a markdown route or \`.json\` to an OpenAPI/proto route to receive the parseable variant.

{{toc}}

## Optional

{{toc:optional}}
`

const TEMPLATE_FILENAME = "llms.txt"
const PLACEHOLDER_RE = /\{\{([\w-]+)(?::([\w-]+))?\}\}/g

type Entry = {
  title: string
  description: string | undefined
  url: string
  /** First non-empty segment of `route.path`, title-cased. Root files bucket as "Docs". */
  group: string
  optional: boolean
  /** Original route path, used for stable intra-group ordering. */
  routePath: string
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
  const entries = pages.map((page) => buildEntry(page, ctx.config))
  const grouped = groupByDirectory(entries.filter((e) => !e.optional))
  const optional = entries.filter((e) => e.optional)

  return renderTemplate(template, {
    name: ctx.config.name,
    description: ctx.config.description ?? "",
    base_url: ctx.config.base_url ?? "",
    toc: renderGroupedToc(grouped),
    "toc:optional": renderFlatToc(optional),
  })
}

async function resolveTemplate(ctx: BuildContext): Promise<string> {
  if (ctx.templatesDir === null) return BUNDLED_DEFAULT
  const file = Bun.file(path.join(ctx.templatesDir, TEMPLATE_FILENAME))
  if (!(await file.exists())) return BUNDLED_DEFAULT
  return await file.text()
}

function buildEntry(page: RenderedPage, config: AidConfig): Entry {
  const route = page.route
  const fm = route.frontmatter
  const title =
    typeof fm?.title === "string" && fm.title.length > 0 ? fm.title : page.searchTokens.title
  return {
    title,
    description: page.description,
    url: machineUrlFor(route, config),
    group: groupLabelFor(route.path),
    optional: fm?.llms === "optional",
    routePath: route.path,
  }
}

/**
 * Produce the machine-readable URL for a route: `.json` for spec-shaped pages
 * (OpenAPI, proto), `.md` for prose pages. Root `/` collapses to `/index<suffix>`
 * so it matches the file `outputPathForExport` writes (`<outputDir>/index.<ext>`).
 * Absolute when `config.base_url` is set; path-only otherwise.
 */
function machineUrlFor(route: Route, config: AidConfig): string {
  const suffix = route.kind === "openapi" || route.kind === "proto" ? ".json" : ".md"
  const localPath = route.path === "/" ? `/index${suffix}` : `${route.path}${suffix}`
  const prefix = config.base_path === "/" ? "" : config.base_path.replace(/\/$/, "")
  const withBase = `${prefix}${localPath}`
  if (!config.base_url) return withBase
  return new URL(withBase, config.base_url).toString()
}

/** Root files → "Docs". Otherwise: first path segment, title-cased ("getting-started" → "Getting Started"). */
function groupLabelFor(routePath: string): string {
  if (routePath === "/") return "Docs"
  const segments = routePath.replace(/^\//, "").split("/")
  const first = segments.length > 1 ? segments[0] : null
  if (first === null || first === undefined || first === "") return "Docs"
  return titleCase(first)
}

function titleCase(slug: string): string {
  return slug
    .split(/[-_]/)
    .filter((s) => s.length > 0)
    .map((s) => s[0]?.toUpperCase() + s.slice(1))
    .join(" ")
}

function groupByDirectory(entries: Entry[]): Map<string, Entry[]> {
  const groups = new Map<string, Entry[]>()
  for (const e of entries) {
    const bucket = groups.get(e.group) ?? []
    bucket.push(e)
    groups.set(e.group, bucket)
  }
  for (const bucket of groups.values()) {
    bucket.sort((a, b) => (a.routePath < b.routePath ? -1 : a.routePath > b.routePath ? 1 : 0))
  }
  return groups
}

function renderGroupedToc(groups: Map<string, Entry[]>): string {
  // `Docs` (the root bucket) pins first; remaining groups alphabetical.
  const keys = [...groups.keys()].sort((a, b) => {
    if (a === "Docs") return -1
    if (b === "Docs") return 1
    return a < b ? -1 : a > b ? 1 : 0
  })
  const blocks: string[] = []
  for (const key of keys) {
    const entries = groups.get(key) ?? []
    if (entries.length === 0) continue
    blocks.push(`## ${key}\n\n${entries.map(renderBullet).join("\n")}`)
  }
  return blocks.join("\n\n")
}

function renderFlatToc(entries: Entry[]): string {
  if (entries.length === 0) return ""
  const sorted = [...entries].sort((a, b) =>
    a.routePath < b.routePath ? -1 : a.routePath > b.routePath ? 1 : 0,
  )
  return sorted.map(renderBullet).join("\n")
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
