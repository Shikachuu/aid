import path from "node:path"
import type { ResolveLink, RouteIndex } from "../../core/links"
import { routeUrl } from "../../core/router"
import type { AnchorRef, RenderedPage, Route, SearchTokens } from "../../core/types"
import { render } from "../../jsx-runtime"
import { PageJsonSchema } from "../../theme/components/PageJsonSchema"
import {
  assertAcyclic,
  collectAnchors,
  firstParagraph,
  nonEmpty,
  parseHtmlFragment,
  refWarning,
  vfileDiagnostics,
} from "../shared"
import { jsonFence, renderMarkdownFragment } from "./markdown"
import { buildSchemaDocument, type SchemaDocument, type SchemaNode } from "./model"

/** What the pipeline passes to {@link renderJsonSchema}; unit tests omit `index` and `resolveLink`. */
export type RenderJsonSchemaArgs = {
  route: Route
  sourcePath: string
  /** Route table, so a `$ref` to another schema page becomes a link to it. */
  index?: RouteIndex
  basePath?: string
  /** Rewrites and checks relative links in descriptions, as for markdown pages. */
  resolveLink?: ResolveLink
}

/**
 * Render a JSON Schema source to static HTML: one block per field with its
 * type, chips, description, and constraints, a schema example, and a section
 * per definition. The page ships no browser runtime. The `.json` export is the
 * schema itself, converted to JSON when the source is YAML.
 */
export async function renderJsonSchema(args: RenderJsonSchemaArgs): Promise<RenderedPage> {
  const source = await Bun.file(args.sourcePath).text()
  const raw = parseSource(source, args.sourcePath)
  const basePath = args.basePath ?? "/"
  const doc = buildSchemaDocument(raw, {
    sourcePath: args.sourcePath,
    pageUrlForFile: (file) => {
      const target = args.index?.bySource.get(file)
      return target?.kind === "jsonschema" ? routeUrl(target.path, basePath) : undefined
    },
  })

  const nodes = allNodes(doc)
  const descriptions = [...new Set(nodes.flatMap((n) => (n.description ? [n.description] : [])))]
  const [rendered, examples] = await Promise.all([
    Promise.all(descriptions.map((d) => renderMarkdownFragment(d, args.resolveLink))),
    Promise.all(doc.examples.map((e) => renderMarkdownFragment(jsonFence(e)))),
  ])
  const descriptionHtml = new Map(descriptions.map((d, i) => [d, rendered[i]?.html ?? ""]))
  const exampleHtml = examples.map((e) => e.html)

  const lines = descriptions.map((d) => descriptionLine(source, d, isJsonPath(args.sourcePath)))
  const title = doc.title ?? path.basename(args.sourcePath, path.extname(args.sourcePath))
  const html = render(PageJsonSchema({ title, doc, descriptionHtml, exampleHtml }))

  return {
    route: args.route,
    html,
    searchTokens: searchTokens(doc, title, nodes, descriptions),
    exports: [{ suffix: ".json", body: JSON.stringify(raw, null, 2) }],
    hasMermaid: false,
    hasOpenApi: false,
    hasProto: false,
    description: firstParagraph(doc.root.description),
    knownAnchorIds: collectAnchors(parseHtmlFragment(html)),
    anchorRefs: [
      ...rendered.flatMap((r, i) =>
        r.anchorRefs.map((ref) => ({ ...ref, line: lines[i], col: undefined })),
      ),
      ...pageLinkRefs(doc, args.index),
    ],
    diagnostics: [
      ...doc.warnings.map((w) => refWarning(args.sourcePath, "jsonschema/ref", w)),
      ...rendered.flatMap((r, i) =>
        vfileDiagnostics(r.file, args.sourcePath).map((d) => ({
          ...d,
          line: lines[i],
          col: undefined,
        })),
      ),
    ],
  }
}

const isJsonPath = (sourcePath: string): boolean => sourcePath.toLowerCase().endsWith(".json")

function parseSource(source: string, sourcePath: string): unknown {
  let parsed: unknown
  try {
    parsed = isJsonPath(sourcePath) ? JSON.parse(source) : Bun.YAML.parse(source)
  } catch (err) {
    throw new Error(`aid: failed to parse JSON Schema at ${sourcePath}: ${(err as Error).message}`)
  }
  assertAcyclic(parsed, `JSON Schema at ${sourcePath}`)
  return parsed
}

function descriptionLine(source: string, description: string, json: boolean): number | undefined {
  const first = description.split("\n", 1)[0]?.trim() ?? ""
  if (first === "") {
    return undefined
  }
  const at = source.indexOf(json ? JSON.stringify(first).slice(1, -1) : first)
  return at === -1 ? undefined : source.slice(0, at).split("\n").length
}

function pageLinkRefs(doc: SchemaDocument, index: RouteIndex | undefined): AnchorRef[] {
  const refs = new Map<string, AnchorRef>()
  for (const link of doc.crossPageAnchorRefs) {
    const target = index?.bySource.get(link.file)
    if (target) {
      refs.set(`${target.path}#${link.fragment}`, {
        routePath: target.path,
        fragment: link.fragment,
        href: link.href,
      })
    }
  }
  return [...refs.values()]
}

function allNodes(doc: SchemaDocument): SchemaNode[] {
  const out: SchemaNode[] = []
  const walk = (node: SchemaNode): void => {
    out.push(node)
    for (const child of [
      ...node.properties,
      ...node.prefixItems,
      ...(node.items ? [node.items] : []),
      ...node.variants.flatMap((g) => g.options),
    ]) {
      walk(child)
    }
  }
  walk(doc.root)
  for (const def of doc.definitions) {
    walk(def)
  }
  return out
}

function searchTokens(
  doc: SchemaDocument,
  title: string,
  nodes: SchemaNode[],
  descriptions: string[],
): SearchTokens {
  const properties = nodes.filter((n) => n.kind === "property" && n.path !== "").map((n) => n.path)
  const definitions = doc.definitions.map((d) => d.label)
  return {
    title,
    body: descriptions.join("\n\n"),
    headings: definitions,
    extras: nonEmpty({ properties: [...new Set(properties)], definitions }),
  }
}
