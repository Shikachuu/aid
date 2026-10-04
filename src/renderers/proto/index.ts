import path from "node:path"
import { type ProtoAst, type ProtoMessage, parseProto } from "@aid/proto-ui/parser"
import type { RenderedPage, Route, SearchTokens } from "../../core/types"
import { render } from "../../jsx-runtime"
import { PageProto } from "../../theme/components/PageProto"
import { nonEmpty } from "../shared"

/** Arguments for {@link renderProto}. */
export type RenderProtoArgs = {
  route: Route
  /** Absolute path of the source `.proto` file on disk. */
  sourcePath: string
}

/**
 * Render a `.proto` source as a hydration shell. The page holds a mount div
 * whose `data-proto-url` points at the `.proto` export, and `aid-proto.js`
 * fetches that file and renders the UI in the browser. The build still parses
 * the AST to fill `searchTokens` and the page description.
 *
 * The only export is the `.proto` source itself, which agents read as is.
 */
export const renderProto = async (args: RenderProtoArgs): Promise<RenderedPage> => {
  const source = await Bun.file(args.sourcePath).text()
  const ast = parseProto(source)
  const fallbackTitle = path.basename(args.sourcePath, path.extname(args.sourcePath))
  const title = ast.package ?? fallbackTitle
  const description = firstParagraph(ast.packageLeadingComment)
  const protoSiblingHref = computeProtoSiblingHref(args.route.path)

  const html = render(
    PageProto({
      title,
      protoSiblingHref,
      machineUrl: `${args.route.path}.proto`,
    }),
  )

  return {
    route: args.route,
    html,
    searchTokens: extractSearchTokens(ast, title),
    exports: [{ suffix: ".proto", body: source }],
    hasMermaid: false,
    hasOpenApi: false,
    hasProto: true,
    description,
  }
}

const computeProtoSiblingHref = (routePath: string): string => {
  if (routePath === "/") {
    return "./index.proto"
  }
  const last = routePath.split("/").filter(Boolean).pop() ?? "index"
  return `../${last}.proto`
}

const firstParagraph = (text: string | null): string | undefined => {
  if (!text) {
    return undefined
  }
  const para = text.split(/\r?\n\s*\r?\n/, 1)[0]?.trim()
  if (!para) {
    return undefined
  }
  return para.replace(/\s+/g, " ")
}

const collectMessageTokens = (m: ProtoMessage, fqns: string[], comments: string[]): void => {
  fqns.push(m.fqn)
  if (m.comment) {
    comments.push(m.comment)
  }
  for (const f of m.fields) {
    if (f.comment) {
      comments.push(f.comment)
    }
  }
  for (const nm of m.nestedMessages) {
    collectMessageTokens(nm, fqns, comments)
  }
  for (const ne of m.nestedEnums) {
    fqns.push(ne.fqn)
    if (ne.comment) {
      comments.push(ne.comment)
    }
  }
}

const extractSearchTokens = (ast: ProtoAst, title: string): SearchTokens => {
  const messages: string[] = []
  const services: string[] = []
  const rpcs: string[] = []
  const enums: string[] = []
  const fieldNames: string[] = []
  const comments: string[] = []

  if (ast.packageLeadingComment) {
    comments.push(ast.packageLeadingComment)
  }

  for (const m of ast.messages) {
    collectMessageTokens(m, messages, comments)
    for (const f of m.fields) {
      fieldNames.push(f.name)
    }
  }
  for (const e of ast.enums) {
    enums.push(e.fqn)
    if (e.comment) {
      comments.push(e.comment)
    }
  }
  for (const s of ast.services) {
    services.push(s.fqn)
    if (s.comment) {
      comments.push(s.comment)
    }
    for (const rpc of s.rpcs) {
      rpcs.push(`${s.fqn}.${rpc.name}`)
      if (rpc.comment) {
        comments.push(rpc.comment)
      }
    }
  }

  return {
    title,
    body: comments.join("\n\n"),
    headings: [],
    extras: nonEmpty({ messages, services, rpcs, enums, fields: [...new Set(fieldNames)] }),
  }
}
