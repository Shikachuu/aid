import type { RenderedPage, Route } from "../../core/types"

/**
 * Render a markdown file via unified + remark-gfm + remark-frontmatter +
 * remark-rehype + rehype-stringify with Mermaid passthrough and shiki
 * code-fence highlighting.
 *
 * Stub.
 */
export async function renderMarkdown(_route: Route): Promise<RenderedPage> {
  throw new Error("renderMarkdown(): not implemented")
}
