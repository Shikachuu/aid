import type { AidConfig } from "../../core/config"
import { DarkToggle } from "./DarkToggle"
import { SearchBox, type SearchBoxProps } from "./SearchBox"

type HeaderProps = {
  config: AidConfig
  search?: SearchBoxProps
}

/** Render the site header. Omit `search` to leave out the search box. */
export function Header({ config, search }: HeaderProps) {
  return (
    <header class="aid-header">
      <a class="aid-brand" href={config.base_path}>
        {config.name}
      </a>
      {search ? <SearchBox {...search} /> : null}
      <DarkToggle />
    </header>
  )
}
