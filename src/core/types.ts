import type { Frontmatter } from "../renderers/markdown/frontmatter"
import type { AidConfig } from "./config"

export type { Frontmatter }

export type PageKind = "markdown" | "html" | "openapi" | "proto" | "index"

export type Route = {
  /** Source file path relative to repo root. */
  source: string
  /** Public route path (joined with config.base_path at render time). */
  path: string
  /** Page kind drives renderer selection. */
  kind: PageKind
  /** Optional frontmatter (markdown only). */
  frontmatter?: Frontmatter
}

export type RenderedPage = {
  route: Route
  /** Final rendered HTML body (without the surrounding <html>/Layout chrome). */
  html: string
  /** Tokens for the search index. */
  searchTokens: SearchTokens
  /** Side-channel exports (`.md` / `.json`). */
  exports: SideChannelExport[]
  /** True iff the rendered body contains at least one mermaid diagram. Drives lazy <script> injection. */
  hasMermaid: boolean
  /** True iff the page is an OpenAPI reference. Drives lazy Scalar runtime injection. */
  hasOpenApi: boolean
  /** True iff the page is a Proto reference. Drives lazy proto-ui runtime injection. */
  hasProto: boolean
  /** One-line summary used in llms.txt bullets and (later) <meta description>. */
  description?: string
}

export type SearchTokens = {
  title: string
  body: string
  headings: string[]
  /** Format-specific extras: operationIds, message names, etc. */
  extras: Record<string, string[]>
}

export type SideChannelExport = {
  /** URL suffix appended to the route, e.g. ".md", ".json", ".proto". */
  suffix: ".md" | ".json" | ".proto"
  /** Content type for the response. */
  contentType: string
  /** Body bytes / string. */
  body: string
}

export type NavNode = {
  label: string
  path?: string
  children?: NavNode[]
}

export type BuildContext = {
  config: AidConfig
  /** Repo root (where aid.yaml lives). */
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
