import path from "node:path"
import type { RenderedPage, Route } from "../../core/types"
import { render } from "../../jsx-runtime"
import { PageOpenAPI } from "../../theme/components/PageOpenAPI"
import { firstParagraph, nonEmpty, refWarning } from "../shared"
import { parseOpenApi } from "./parser"

/** What the pipeline passes to {@link renderOpenApi}. */
export type RenderOpenApiArgs = {
  route: Route
  /** Absolute path of the source `.yaml` / `.yml` / `.json` spec on disk. */
  sourcePath: string
}

/**
 * Render an OpenAPI spec as a shell that the `aid-openapi` bundle hands to
 * Scalar. Operation ids, paths, webhooks, schema and parameter names, and
 * summaries go into search extras, so a search for `getPets` finds the page.
 */
export async function renderOpenApi(args: RenderOpenApiArgs): Promise<RenderedPage> {
  const source = await Bun.file(args.sourcePath).text()
  const { doc, warnings } = await parseOpenApi(source, args.sourcePath)

  const info = (doc.info ?? {}) as { title?: unknown; description?: unknown }
  const fallbackTitle = path.basename(args.sourcePath, path.extname(args.sourcePath))
  const title = typeof info.title === "string" && info.title.length > 0 ? info.title : fallbackTitle
  const description =
    typeof info.description === "string" ? firstParagraph(info.description) : undefined

  const specJson = JSON.stringify(doc)
  const html = render(PageOpenAPI({ title, specJson }))

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
    diagnostics: warnings.map((w) => refWarning(args.sourcePath, "openapi/ref", w)),
  }
}

const HTTP_VERBS = new Set(["get", "post", "put", "patch", "delete", "head", "options", "trace"])

function extractSearchExtras(doc: Record<string, unknown>): Record<string, string[]> {
  const lists = {
    operationIds: [] as string[],
    summaries: [] as string[],
    parameters: [] as string[],
  }
  const docPaths = asRecord(doc.paths)
  const webhooks = asRecord(doc.webhooks)
  for (const pathItem of [...Object.values(docPaths), ...Object.values(webhooks)]) {
    collectPathItem(pathItem, lists)
  }

  const schemas = Object.keys(asRecord(asRecord(doc.components).schemas))

  return nonEmpty({
    operationIds: lists.operationIds,
    paths: Object.keys(docPaths),
    webhooks: Object.keys(webhooks),
    schemas,
    parameters: [...new Set(lists.parameters)],
    summaries: lists.summaries,
  })
}

function collectPathItem(
  pathItem: unknown,
  lists: { operationIds: string[]; summaries: string[]; parameters: string[] },
): void {
  const item = asRecord(pathItem)
  collectParameters(item.parameters, lists.parameters)
  for (const [verbKey, op] of Object.entries(item)) {
    if (!HTTP_VERBS.has(verbKey)) {
      continue
    }
    const opObj = asRecord(op)
    if (typeof opObj.operationId === "string") {
      lists.operationIds.push(opObj.operationId)
    }
    if (typeof opObj.summary === "string") {
      lists.summaries.push(opObj.summary)
    }
    collectParameters(opObj.parameters, lists.parameters)
  }
}

function collectParameters(params: unknown, into: string[]): void {
  if (!Array.isArray(params)) {
    return
  }
  for (const param of params) {
    const name = asRecord(param).name
    if (typeof name === "string") {
      into.push(name)
    }
  }
}

const asRecord = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
