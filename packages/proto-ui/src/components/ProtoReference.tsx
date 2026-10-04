import { type UseProtoAstOptions, useProtoAst } from "../hooks/useProtoAst"
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

/**
 * Render the full documentation for one `.proto` file: sidebar, package header, services, messages
 * and enums. Shows a loading state until the source parses, and an error state when loading or
 * parsing fails.
 */
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
