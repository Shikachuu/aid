import type { AidConfig } from "../../core/config"

/** Render the site footer with the configured site name and version. */
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
