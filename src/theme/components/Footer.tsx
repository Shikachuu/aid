import type { AidConfig } from "../../core/config"

export function Footer({ config }: { config: AidConfig }) {
  return (
    <footer class="aid-footer">
      <p>
        {config.name}
        {config.version ? ` · v${config.version}` : ""}
      </p>
    </footer>
  )
}
