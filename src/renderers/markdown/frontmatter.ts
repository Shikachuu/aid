import { z } from "zod"

/** Sidebar label and position, shared by page frontmatter and `_meta.yaml` entries. */
export const SidebarEntrySchema = z
  .object({
    label: z.string().min(1).optional().describe("Sidebar label. Defaults to the page title."),
    order: z
      .number()
      .optional()
      .describe("Sort key among siblings, ascending. Entries without one sort last, by name."),
  })
  .strict()

/**
 * Schema for a folder's `_meta.yaml`: sidebar overrides keyed by child route
 * segment (a page name without extension, or a subfolder name). The key
 * `index` addresses the site root page in the content root.
 */
export const NavMetaSchema = z.record(z.string(), SidebarEntrySchema)

/**
 * Schema for the YAML frontmatter block at the top of a markdown source. Known
 * keys are typed. Unknown keys pass through, so users can keep their own
 * metadata there.
 */
export const FrontmatterSchema = z
  .object({
    title: z.string().min(1).optional().describe("Page title — feeds <title> and <meta>."),
    description: z.string().optional().describe('Short summary — feeds <meta name="description">.'),
    llms: z
      .literal("optional")
      .optional()
      .describe("Move this page to the `## Optional` section of llms.txt."),
    sidebar: SidebarEntrySchema.optional().describe("Sidebar label and position for this page."),
  })
  .catchall(z.unknown())

/** Page metadata that `route.frontmatter` carries to Layout, llms.txt and search. */
export type Frontmatter = z.infer<typeof FrontmatterSchema>

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

/** Result of separating the YAML block from the markdown body. */
export type ExtractedFrontmatter = {
  frontmatter: Frontmatter | undefined
  body: string
  /** 1-based source line where `body` starts, for mapping body positions back to the file. */
  bodyLine: number
}

/**
 * Pull the leading `---`-delimited YAML block off a markdown source, parse it
 * with `Bun.YAML`, and validate it against {@link FrontmatterSchema}.
 * `frontmatter` is `undefined` when the block is missing or empty. Throws on
 * malformed YAML or schema violations, so the build fails instead of dropping
 * fields.
 */
export function extractFrontmatter(source: string): ExtractedFrontmatter {
  const match = source.match(FRONTMATTER_RE)
  if (!match) {
    return { frontmatter: undefined, body: source, bodyLine: 1 }
  }
  const bodyLine = match[0].split("\n").length
  const yamlText = match[1] ?? ""
  const parsed = Bun.YAML.parse(yamlText)
  if (parsed == null) {
    return { frontmatter: undefined, body: source.slice(match[0].length), bodyLine }
  }
  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("frontmatter must be a YAML mapping, not a scalar or sequence")
  }
  const frontmatter = FrontmatterSchema.parse(parsed)
  return { frontmatter, body: source.slice(match[0].length), bodyLine }
}
