import { useCallback, useState } from "react"
import { DeprecatedBadge } from "./DeprecatedBadge"

export type EntityHeaderProps = {
  kind: "message" | "enum" | "service" | "package"
  name: string
  fqn: string
  deprecated?: boolean
}

const KIND_LABEL: Record<EntityHeaderProps["kind"], string> = {
  message: "message",
  enum: "enum",
  service: "service",
  package: "package",
}

export const EntityHeader = ({ kind, name, fqn, deprecated = false }: EntityHeaderProps) => {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(async () => {
    if (typeof window === "undefined") {
      return
    }
    const url = `${window.location.origin}${window.location.pathname}#${fqn}`
    if (!navigator.clipboard) {
      return
    }
    await navigator.clipboard.writeText(url)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }, [fqn])

  return (
    <header className="proto-entity-header" id={fqn}>
      <span className="proto-entity-kind">{KIND_LABEL[kind]}</span>
      <h2 className="proto-entity-name">{name}</h2>
      {deprecated ? <DeprecatedBadge /> : null}
      <button
        type="button"
        className="proto-entity-copy"
        onClick={copy}
        aria-label={copied ? "Link copied" : "Copy link"}
      >
        {copied ? "✓" : "#"}
      </button>
    </header>
  )
}
