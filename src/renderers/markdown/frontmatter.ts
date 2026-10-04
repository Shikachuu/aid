import { z } from "zod"

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
  })
  .catchall(z.unknown())

/** Page metadata that `route.frontmatter` carries to Layout, llms.txt and search. */
export type Frontmatter = z.infer<typeof FrontmatterSchema>

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

/** Result of separating the YAML block from the markdown body. */
export type ExtractedFrontmatter = {
  frontmatter: Frontmatter | undefined
  body: string
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
    return { frontmatter: undefined, body: source }
  }
  const yamlText = match[1] ?? ""
  const parsed = Bun.YAML.parse(yamlText)
  if (parsed == null) {
    return { frontmatter: undefined, body: source.slice(match[0].length) }
  }
  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("frontmatter must be a YAML mapping, not a scalar or sequence")
  }
  const frontmatter = FrontmatterSchema.parse(parsed)
  return { frontmatter, body: source.slice(match[0].length) }
}
