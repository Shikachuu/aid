import { AIButton } from "./AIButton"

type PageProtoProps = {
  title: string
  /** Relative URL of the sibling `.proto` source the React component will fetch. */
  protoSiblingHref: string
  machineUrl: string
}

/**
 * Render the proto page shell. The `aid-proto` browser bundle reads `data-proto-url` from
 * `#aid-proto-mount`, fetches the `.proto` file, and renders the reference in its place.
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
