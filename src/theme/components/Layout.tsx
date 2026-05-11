import type { AidConfig } from "../../core/config"
import type { NavNode } from "../../core/types"
import { RawHtml } from "../../jsx-runtime"
import { Footer } from "./Footer"
import { Header } from "./Header"
import { Nav } from "./Nav"

export type LayoutProps = {
  config: AidConfig
  title: string
  description?: string
  nav: NavNode[]
  stylesheetHref: string
  webBundleHref: string
  /** Per-page; injected only when the page contains at least one mermaid diagram. */
  mermaidBundleHref?: string | null
  /** Per-page; injected only when the page is an OpenAPI reference. */
  openapiBundleHref?: string | null
  /**
   * Scalar's bundled stylesheet, linked only on OpenAPI pages. Without it
   * Scalar's UI renders with no chrome — icons appear at intrinsic size,
   * spacing collapses, and the search/sidebar are unstyled.
   */
  openapiStylesheetHref?: string | null
  bodyHtml: string
}

export function Layout(props: LayoutProps) {
  const {
    config,
    title,
    description,
    nav,
    stylesheetHref,
    webBundleHref,
    mermaidBundleHref,
    openapiBundleHref,
    openapiStylesheetHref,
    bodyHtml,
  } = props
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>
          {title} – {config.name}
        </title>
        {description ? <meta name="description" content={description} /> : null}
        <link rel="stylesheet" href={stylesheetHref} />
        {openapiStylesheetHref ? <link rel="stylesheet" href={openapiStylesheetHref} /> : null}
      </head>
      <body class="aid-body">
        <Header config={config} />
        <div class="aid-shell">
          <aside class="aid-sidebar">
            <Nav tree={nav} />
          </aside>
          <main class="aid-main">
            <RawHtml html={bodyHtml} />
          </main>
        </div>
        <Footer config={config} />
        <script type="module" src={webBundleHref} defer />
        {mermaidBundleHref ? <script type="module" src={mermaidBundleHref} defer /> : null}
        {openapiBundleHref ? <script type="module" src={openapiBundleHref} defer /> : null}
      </body>
    </html>
  )
}
