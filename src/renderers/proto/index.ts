import path from "node:path"
import { type ProtoAst, type ProtoEnum, type ProtoMessage, parseProto } from "@aid/proto-ui/parser"
import { exportPath } from "../../core/router"
import type { RenderedPage, Route, SearchTokens } from "../../core/types"
import { render } from "../../jsx-runtime"
import { PageProto } from "../../theme/components/PageProto"
import { firstParagraph, nonEmpty } from "../shared"

/** What the pipeline passes to {@link renderProto}. */
type RenderProtoArgs = {
  route: Route
  sourcePath: string
  /** `config.base_path`, so the browser fetches the `.proto` export by absolute URL. */
  basePath?: string
}

/**
 * Render a `.proto` source as a shell that `aid-proto.js` hydrates from the
 * `.proto` export. The export URL is absolute because page URLs have no
 * trailing slash, so a relative one would resolve one level too high. The
 * build still parses the AST for search and the page description.
 */
export const renderProto = async (args: RenderProtoArgs): Promise<RenderedPage> => {
  const source = await Bun.file(args.sourcePath).text()
  const ast = parseOrExplain(source, args.sourcePath)
  const fallbackTitle = path.basename(args.sourcePath, path.extname(args.sourcePath))
  const title = ast.package ?? fallbackTitle
  const description = firstParagraph(ast.packageLeadingComment)
  const protoUrl = path.posix.join(args.basePath ?? "/", exportPath(args.route, ".proto"))

  const html = render(PageProto({ title, protoUrl }))

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

type TokenLists = {
  messages: string[]
  enums: string[]
  values: string[]
  fields: string[]
  comments: string[]
}

const pushComment = (lists: TokenLists, comment: string | null): void => {
  if (comment) {
    lists.comments.push(comment)
  }
}

const collectEnumTokens = (e: ProtoEnum, lists: TokenLists): void => {
  lists.enums.push(e.fqn)
  pushComment(lists, e.comment)
  for (const v of e.values) {
    lists.values.push(v.name)
    pushComment(lists, v.comment)
  }
}

const collectMessageTokens = (m: ProtoMessage, lists: TokenLists): void => {
  lists.messages.push(m.fqn)
  pushComment(lists, m.comment)
  for (const f of m.fields) {
    lists.fields.push(f.name)
    pushComment(lists, f.comment)
  }
  for (const o of m.oneofs) {
    lists.fields.push(o.name)
    pushComment(lists, o.comment)
  }
  for (const nm of m.nestedMessages) {
    collectMessageTokens(nm, lists)
  }
  for (const ne of m.nestedEnums) {
    collectEnumTokens(ne, lists)
  }
}

const extractSearchTokens = (ast: ProtoAst, title: string): SearchTokens => {
  const lists: TokenLists = { messages: [], enums: [], values: [], fields: [], comments: [] }
  const services: string[] = []
  const rpcs: string[] = []
  pushComment(lists, ast.packageLeadingComment)
  for (const m of ast.messages) {
    collectMessageTokens(m, lists)
  }
  for (const e of ast.enums) {
    collectEnumTokens(e, lists)
  }
  for (const s of ast.services) {
    services.push(s.fqn)
    pushComment(lists, s.comment)
    for (const rpc of s.rpcs) {
      rpcs.push(`${s.fqn}.${rpc.name}`)
      pushComment(lists, rpc.comment)
    }
  }
  return {
    title,
    body: lists.comments.join("\n\n"),
    headings: [],
    extras: nonEmpty({
      messages: lists.messages,
      services,
      rpcs,
      enums: lists.enums,
      values: [...new Set(lists.values)],
      fields: [...new Set(lists.fields)],
    }),
  }
}

const parseOrExplain = (source: string, sourcePath: string): ProtoAst => {
  try {
    return parseProto(source)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`aid: failed to parse ${sourcePath}: ${message}`, { cause: err })
  }
}
