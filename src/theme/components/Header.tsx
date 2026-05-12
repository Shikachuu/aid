import type { AidConfig } from "../../core/config"
import { DarkToggle } from "./DarkToggle"
import { SearchBox, type SearchBoxProps } from "./SearchBox"

/** Props for {@link Header}. */
export type HeaderProps = {
  config: AidConfig
  /** Search affordance config; pass `undefined` to omit the SearchBox entirely. */
  search?: SearchBoxProps
}

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
