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

  if (result.status === "idle") {
    return (
      <div className={rootClass}>
        <p className="proto-empty">Provide protoText, protoUrl, or ast.</p>
      </div>
    )
  }
  if (result.status === "loading") {
    return (
      <div className={rootClass}>
        <p className="proto-loading">Loading proto documentation…</p>
      </div>
    )
  }
  if (result.status === "error") {
    return (
      <div className={rootClass}>
        <pre className="proto-error">Failed to load proto: {result.error.message}</pre>
      </div>
    )
  }
  return (
    <ProtoReferenceContent
      ast={result.ast}
      baseHref={baseHref}
      className={rootClass}
      fileSourceUrl={fileSourceUrl}
    />
  )
}

type ProtoReferenceContentProps = {
  ast: ProtoAst
  baseHref?: string
  className: string
  fileSourceUrl?: string
}

const ProtoReferenceContent = ({
  ast,
  baseHref,
  className,
  fileSourceUrl,
}: ProtoReferenceContentProps) => (
  <div className={className}>
    <Sidebar ast={ast} baseHref={baseHref} />
    <main className="proto-main">
      <PackageHeader
        packageName={ast.package}
        leadingComment={ast.packageLeadingComment}
        fileSourceUrl={fileSourceUrl}
      />
      {ast.services.map((s) => (
        <ServiceBlock key={s.fqn} service={s} baseHref={baseHref} />
      ))}
      {ast.messages.map((m) => (
        <MessageBlock key={m.fqn} message={m} baseHref={baseHref} />
      ))}
      {ast.enums.map((e) => (
        <EnumBlock key={e.fqn} enumEntity={e} />
      ))}
    </main>
  </div>
)
