import { useState } from "react"
import { DeprecatedBadge } from "./DeprecatedBadge"

export type EntityHeaderProps = {
  kind: "message" | "enum" | "service" | "package"
  name: string
  fqn: string
  deprecated?: boolean
}

export const EntityHeader = ({ kind, name, fqn, deprecated = false }: EntityHeaderProps) => {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    const url = `${window.location.origin}${window.location.pathname}#${fqn}`
    if (!navigator.clipboard) {
      return
    }
    await navigator.clipboard.writeText(url)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <header className="proto-entity-header" id={fqn}>
      <span className="proto-entity-kind">{kind}</span>
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
