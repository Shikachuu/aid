import type { AidConfig } from "../../core/config"
import { DarkToggle } from "./DarkToggle"
import { SearchBox } from "./SearchBox"

export function Header({ config }: { config: AidConfig }) {
  return (
    <header class="aid-header">
      <a class="aid-brand" href={config.base_path}>
        {config.name}
      </a>
      <SearchBox />
      <DarkToggle />
    </header>
  )
}
