import path from "node:path"
import type { RenderedPage, Route } from "../../core/types"
import { render } from "../../jsx-runtime"
import { PageOpenAPI } from "../../theme/components/PageOpenAPI"
import { parseOpenApi } from "./parser"

/** Arguments for {@link renderOpenApi}. */
export type RenderOpenApiArgs = {
  route: Route
  /** Absolute path of the source `.yaml` / `.yml` / `.json` spec on disk. */
  sourcePath: string
}

/**
 * Parse an OpenAPI spec and produce a `RenderedPage` whose body is the
 * `PageOpenAPI` shell: an `aid-page-openapi` article with the normalized 3.1
 * spec embedded as `<script type="application/json">` plus an empty mount
 * point. The browser-side `aid-openapi` bundle picks the spec out of the
 * script tag and hands it to Scalar. Theming flows through the existing
 * `:where(.aid-page-openapi)` Scalar token bridge in `main.css` — no per-page
 * styling here.
 */
export async function renderOpenApi(args: RenderOpenApiArgs): Promise<RenderedPage> {
  const source = await Bun.file(args.sourcePath).text()
  const { doc, warnings } = await parseOpenApi(source, args.sourcePath)
  for (const w of warnings) console.warn(`aid: ${w}`)

  const info = (doc.info ?? {}) as { title?: unknown; description?: unknown }
  const fallbackTitle = path.basename(args.sourcePath, path.extname(args.sourcePath))
  const title = typeof info.title === "string" && info.title.length > 0 ? info.title : fallbackTitle

  const specJson = JSON.stringify(doc)
  const html = render(PageOpenAPI({ title, specJson, machineUrl: "" }) as never)

  return {
    route: args.route,
    html,
    searchTokens: { title, body: "", headings: [], extras: {} },
    exports: [
      {
        suffix: ".json",
        contentType: "application/json",
        body: JSON.stringify(doc, null, 2),
      },
    ],
    hasMermaid: false,
    hasOpenApi: true,
  }
}
