import type { AidConfig } from "../../core/config"

/** Footer on every page. The version shows only when `aid.yaml` sets one. */
export function Footer({ config }: { config: AidConfig }) {
  return (
    <footer class="aid-footer">
      <p>
        {config.name}
        {config.version ? ` \u00B7 v${config.version}` : ""}
      </p>
    </footer>
  )
}
