import type { AidConfig } from "../../core/config"
import type { NavNode } from "../../core/types"
import { RawHtml } from "../../jsx-runtime"
import { Footer } from "./Footer"
import { Header } from "./Header"
import { Nav } from "./Nav"
import type { SearchBoxProps } from "./SearchBox"

type LayoutProps = {
  config: AidConfig
  title: string
  description?: string
  nav: NavNode[]
  currentPath: string
  stylesheetHref: string
  webBundleHref: string
  mermaidBundleHref?: string | null
  openapiBundleHref?: string | null
  openapiStylesheetHref?: string | null
  protoBundleHref?: string | null
  protoStylesheetHref?: string | null
  search?: SearchBoxProps
  bodyHtml: string
}

/**
 * Render the full HTML document for one page. Each optional bundle and stylesheet href is linked
 * only when set, so a page loads only the runtimes it uses. Omit `search` to turn search off.
 */
export function Layout(props: LayoutProps) {
  const {
    config,
    title,
    description,
    nav,
    currentPath,
    stylesheetHref,
    webBundleHref,
    mermaidBundleHref,
    openapiBundleHref,
    openapiStylesheetHref,
    protoBundleHref,
    protoStylesheetHref,
    search,
    bodyHtml,
  } = props
  return (
    <html lang="en" data-aid-dark-mode={config.theme.dark_mode}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>
          {title} – {config.name}
        </title>
        {description ? <meta name="description" content={description} /> : null}
        <link rel="stylesheet" href={stylesheetHref} />
        {openapiStylesheetHref ? <link rel="stylesheet" href={openapiStylesheetHref} /> : null}
        {protoStylesheetHref ? <link rel="stylesheet" href={protoStylesheetHref} /> : null}
      </head>
      <body class="aid-body">
        <Header config={config} search={search} />
        <div class="aid-shell">
          <aside class="aid-sidebar">
            <details class="aid-sidebar-disclosure">
              <summary class="aid-sidebar-toggle">Menu</summary>
              <Nav tree={nav} currentPath={currentPath} basePath={config.base_path} />
            </details>
          </aside>
          <main class="aid-main">
            <RawHtml html={bodyHtml} />
          </main>
        </div>
        <Footer config={config} />
        <script type="module" src={webBundleHref} />
        {mermaidBundleHref ? <script type="module" src={mermaidBundleHref} /> : null}
        {openapiBundleHref ? <script type="module" src={openapiBundleHref} /> : null}
        {protoBundleHref ? <script type="module" src={protoBundleHref} /> : null}
      </body>
    </html>
  )
}
