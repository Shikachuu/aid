import type { Diagnostic } from "../lint/diagnostics"
import type { Frontmatter } from "../renderers/markdown/frontmatter"
import type { AidConfig } from "./config"

/** Source format of a route. It picks the renderer. */
export type PageKind = "markdown" | "html" | "openapi" | "proto" | "jsonschema"

/**
 * One page discovered under `contentDir` by `buildRoutes`. `source` is absolute,
 * `path` is the route path before `base_path`, and only markdown pages carry
 * `frontmatter`.
 */
export type Route = {
  source: string
  path: string
  kind: PageKind
  frontmatter?: Frontmatter
}

/**
 * Renderer output for one route, before the Layout wraps it. The `has*` flags
 * decide which browser bundles the page loads, and `description` is its
 * llms.txt summary.
 */
export type RenderedPage = {
  route: Route
  html: string
  searchTokens: SearchTokens
  exports: SideChannelExport[]
  hasMermaid: boolean
  hasOpenApi: boolean
  hasProto: boolean
  description?: string
  // Undefined when the ids only exist in the browser, so the anchor check skips the page.
  anchors?: string[]
  anchorRefs?: AnchorRef[]
  diagnostics?: Diagnostic[]
}

/** A link with a `#fragment` into a page, kept for the anchor check after every page renders. */
export type AnchorRef = {
  routePath: string
  fragment: string
  href: string
  line?: number
  col?: number
}

/**
 * Text a renderer extracts from a page for the search index. `extras` holds
 * format-specific names, such as operationIds and proto message names.
 */
export type SearchTokens = {
  title: string
  body: string
  headings: string[]
  extras: Record<string, string[]>
}

/** A machine-readable variant of a page, served at the route path plus `suffix`. */
export type SideChannelExport = {
  suffix: ".md" | ".json" | ".proto"
  body: string
}

/** One entry in the sidebar navigation tree. A node without `path` renders as a plain label. */
export type NavNode = {
  label: string
  path?: string
  children?: NavNode[]
}

/**
 * Validated config plus the `dir.*` folders resolved against the project
 * folder `cwd`. `templatesDir` is null when `dir.templates` is empty.
 */
export type BuildContext = {
  config: AidConfig
  cwd: string
  contentDir: string
  outputDir: string
  templatesDir: string | null
  staticDir: string
}
