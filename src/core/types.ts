import type { Diagnostic } from "../lint/diagnostics"
import type { Frontmatter } from "../renderers/markdown/frontmatter"
import type { AidConfig } from "./config"

/** Source format of a route. It picks the renderer. */
export type PageKind = "markdown" | "html" | "openapi" | "proto"

/** One page discovered under `contentDir` by `buildRoutes`. */
export type Route = {
  /** Absolute path of the source file. */
  source: string
  /** Public route path (joined with config.base_path at render time). */
  path: string
  kind: PageKind
  /** Optional frontmatter (markdown only). */
  frontmatter?: Frontmatter
}

/** Renderer output for one route, before the Layout wraps it. */
export type RenderedPage = {
  route: Route
  /** Final rendered HTML body (without the surrounding <html>/Layout chrome). */
  html: string
  searchTokens: SearchTokens
  /** Machine-readable variants written next to the page (`.md`, `.json`, `.proto`). */
  exports: SideChannelExport[]
  /** True iff the rendered body contains at least one mermaid diagram. Drives lazy <script> injection. */
  hasMermaid: boolean
  /** True iff the page is an OpenAPI reference. Drives lazy Scalar runtime injection. */
  hasOpenApi: boolean
  /** True iff the page is a Proto reference. Drives lazy proto-ui runtime injection. */
  hasProto: boolean
  /** One-line summary used in llms.txt bullets. */
  description?: string
  /** Element ids a link fragment may target. Undefined when ids only exist in the browser. */
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

/** Text a renderer extracts from a page for the search index. */
export type SearchTokens = {
  title: string
  body: string
  headings: string[]
  /** Format-specific extras: operationIds, message names, etc. */
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

/** Validated config plus resolved absolute directories for one build. */
export type BuildContext = {
  config: AidConfig
  /** Project directory. Every configured directory resolves against it. */
  cwd: string
  /** Resolved content root (cwd + config.dir.content). */
  contentDir: string
  /** Resolved output root (cwd + config.dir.output). */
  outputDir: string
  /** Optional override templates directory (cwd + config.dir.templates). */
  templatesDir: string | null
  /** Resolved static-asset root (cwd + config.dir.static). Copied verbatim to outputDir. */
  staticDir: string
}
