import path from "node:path"
import type { RenderedPage, Route } from "../../core/types"
import { render } from "../../jsx-runtime"
import { PageOpenAPI } from "../../theme/components/PageOpenAPI"
import { nonEmpty } from "../shared"
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
  for (const w of warnings) {
    console.warn(`aid: ${w}`)
  }

  const info = (doc.info ?? {}) as { title?: unknown; description?: unknown }
  const fallbackTitle = path.basename(args.sourcePath, path.extname(args.sourcePath))
  const title = typeof info.title === "string" && info.title.length > 0 ? info.title : fallbackTitle
  const description = typeof info.description === "string" ? info.description : undefined

  const specJson = JSON.stringify(doc)
  const html = render(PageOpenAPI({ title, specJson, machineUrl: "" }))

  return {
    route: args.route,
    html,
    searchTokens: { title, body: "", headings: [], extras: extractSearchExtras(doc) },
    exports: [
      {
        suffix: ".json",
        body: JSON.stringify(doc, null, 2),
      },
    ],
    hasMermaid: false,
    hasOpenApi: true,
    hasProto: false,
    description,
  }
}

const HTTP_VERBS = new Set(["get", "post", "put", "patch", "delete", "head", "options", "trace"])

/**
 * Walk a normalized OpenAPI 3.1 document once and bucket the human-meaningful
 * identifiers — operationIds, path strings, schema names, parameter names, and
 * operation summaries — into `searchTokens.extras`. The search-index emitter
 * flattens every bucket into one indexed field, so a query for `getPets` or
 * `petId` lands on the OpenAPI page that defines it.
 */
function extractSearchExtras(doc: Record<string, unknown>): Record<string, string[]> {
  const operationIds: string[] = []
  const paths: string[] = []
  const summaries: string[] = []
  const parameters: string[] = []

  const docPaths = (doc.paths ?? {}) as Record<string, unknown>
  for (const [pathKey, pathItem] of Object.entries(docPaths)) {
    paths.push(pathKey)
    if (pathItem === null || typeof pathItem !== "object") {
      continue
    }
    for (const [verbKey, op] of Object.entries(pathItem as Record<string, unknown>)) {
      if (!HTTP_VERBS.has(verbKey)) {
        continue
      }
      if (op === null || typeof op !== "object") {
        continue
      }
      const opObj = op as { operationId?: unknown; summary?: unknown; parameters?: unknown }
      if (typeof opObj.operationId === "string") {
        operationIds.push(opObj.operationId)
      }
      if (typeof opObj.summary === "string") {
        summaries.push(opObj.summary)
      }
      if (Array.isArray(opObj.parameters)) {
        for (const param of opObj.parameters) {
          const name = (param as { name?: unknown } | null)?.name
          if (typeof name === "string") {
            parameters.push(name)
          }
        }
      }
    }
  }

  const components = doc.components as { schemas?: unknown } | undefined
  const schemas =
    components?.schemas && typeof components.schemas === "object"
      ? Object.keys(components.schemas as Record<string, unknown>)
      : []

  return nonEmpty({
    operationIds,
    paths,
    schemas,
    parameters: [...new Set(parameters)],
    summaries,
  })
}
