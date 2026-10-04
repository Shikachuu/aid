import { useProtoAst } from "../hooks/useProtoAst"
import type { ProtoAst } from "../parser"
import { EnumBlock } from "./EnumBlock"
import { MessageBlock } from "./MessageBlock"
import { PackageHeader } from "./PackageHeader"
import { ServiceBlock } from "./ServiceBlock"
import { Sidebar } from "./Sidebar"

/**
 * Source of the `.proto` documentation. Exactly one must be supplied:
 * `protoText` for inline source, `protoUrl` for built-in fetch, or `ast` when
 * an external loader has already produced the parsed AST.
 */
type ProtoSource =
  | { protoText: string; protoUrl?: never; ast?: never }
  | { protoUrl: string; protoText?: never; ast?: never }
  | { ast: ProtoAst; protoText?: never; protoUrl?: never }

export type ProtoReferenceProps = ProtoSource & {
  /** Anchor base href for cross-links (defaults to ''). */
  baseHref?: string
  /** Optional className appended to the root element. */
  className?: string
  /** Optional link to the original `.proto` file (e.g. GitHub). Shown in the header. */
  fileSourceUrl?: string
}

export const ProtoReference = (props: ProtoReferenceProps) => {
  const result = useProtoAst(props)
  const { baseHref, className, fileSourceUrl } = props
  const rootClass = ["proto-root", className].filter(Boolean).join(" ")

  return (
    <div className={rootClass}>
      {result.status === "loading" ? (
        <p className="proto-loading">Loading proto documentation…</p>
      ) : result.status === "error" ? (
        <pre className="proto-error">Failed to load proto: {result.error.message}</pre>
      ) : (
        <>
          <Sidebar ast={result.ast} baseHref={baseHref} />
          <main className="proto-main">
            <PackageHeader
              packageName={result.ast.package}
              leadingComment={result.ast.packageLeadingComment}
              fileSourceUrl={fileSourceUrl}
            />
            {result.ast.services.map((s) => (
              <ServiceBlock key={s.fqn} service={s} baseHref={baseHref} />
            ))}
            {result.ast.messages.map((m) => (
              <MessageBlock key={m.fqn} message={m} baseHref={baseHref} />
            ))}
            {result.ast.enums.map((e) => (
              <EnumBlock key={e.fqn} enumEntity={e} />
            ))}
          </main>
        </>
      )}
    </div>
  )
}
