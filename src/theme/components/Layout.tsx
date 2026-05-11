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
      </head>
      <body class="aid-body">
        <Header config={config} />
        <div class="aid-shell">
          <aside class="aid-sidebar">
            <Nav tree={nav} />
          </aside>
          <main class="aid-main block">
            <RawHtml html={bodyHtml} />
          </main>
        </div>
        <Footer config={config} />
        <script type="module" src={webBundleHref} defer />
        {mermaidBundleHref ? <script type="module" src={mermaidBundleHref} defer /> : null}
      </body>
    </html>
  )
}
