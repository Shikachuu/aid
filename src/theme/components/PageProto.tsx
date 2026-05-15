import { AIButton } from "./AIButton"

export type PageProtoProps = {
  title: string
  /** Relative URL of the sibling `.proto` source the React component will fetch. */
  protoSiblingHref: string
  machineUrl: string
}

/**
 * Mount-shell for proto pages. Renders a `<div id="aid-proto-mount">` with
 * `data-proto-url={protoSiblingHref}`; the lazy-loaded `aid-proto` web bundle
 * picks that up, fetches the `.proto` file, and renders the full documentation
 * UI client-side via `@aid/proto-ui`. Mirrors `PageOpenAPI`'s mount-shell
 * pattern; the `.proto` source ships as a sibling file, not embedded inline.
 */
export function PageProto({ title, protoSiblingHref, machineUrl }: PageProtoProps) {
  return (
    <article class="aid-page aid-page-proto">
      <div class="aid-page-toolbar">
        <AIButton machineUrl={machineUrl} />
      </div>
      <h1>{title}</h1>
      <div id="aid-proto-mount" class="proto-root" data-proto-url={protoSiblingHref}>
        <p class="aid-proto-loading">Loading proto documentation…</p>
      </div>
    </article>
  )
}
