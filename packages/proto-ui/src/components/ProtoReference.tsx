import { type UseProtoAstOptions, useProtoAst } from "../hooks/useProtoAst"
import type { ProtoAst } from "../parser"
import { EnumBlock } from "./EnumBlock"
import { MessageBlock } from "./MessageBlock"
import { PackageHeader } from "./PackageHeader"
import { ServiceBlock } from "./ServiceBlock"
import { Sidebar } from "./Sidebar"

/** One proto source, as in {@link UseProtoAstOptions}, plus display options. */
export type ProtoReferenceProps = UseProtoAstOptions & {
  /** Prefix for cross-link hrefs. Omit it to link to anchors on the current page. */
  baseHref?: string
  /** Extra class names for the root element, added after `proto-root`. */
  className?: string
  /**
   * URL of the original `.proto` file, for example on GitHub. The package header links to it when
   * set.
   */
  fileSourceUrl?: string
}

const isEmpty = (ast: ProtoAst): boolean =>
  ast.services.length === 0 && ast.messages.length === 0 && ast.enums.length === 0

export const ProtoReference = (props: ProtoReferenceProps) => {
  const result = useProtoAst(props)
  const { baseHref, className, fileSourceUrl } = props
  const rootClass = ["proto-root", className].filter(Boolean).join(" ")

  return (
    <div className={rootClass}>
      {result.status === "loading" ? (
        <p className="proto-loading">Loading proto documentation...</p>
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
            {isEmpty(result.ast) ? (
              <p className="proto-empty">This file declares no services, messages, or enums.</p>
            ) : null}
            {result.ast.services.map((s) => (
              <ServiceBlock key={s.fqn} service={s} baseHref={baseHref} />
            ))}
            {result.ast.messages.map((m) => (
              <MessageBlock
                key={m.fqn}
                message={m}
                syntax={result.ast.syntax}
                baseHref={baseHref}
              />
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
