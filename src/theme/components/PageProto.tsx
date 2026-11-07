type PageProtoProps = {
  title: string
  protoUrl: string
}

/**
 * Render the proto page shell. The `aid-proto` browser bundle reads `data-proto-url` from
 * `#aid-proto-mount`, fetches the `.proto` file, and renders the reference in its place.
 * Without JavaScript the page links to the `.proto` file instead.
 */
export function PageProto({ title, protoUrl }: PageProtoProps) {
  return (
    <article class="aid-page aid-page-proto">
      <h1>{title}</h1>
      <div id="aid-proto-mount" data-proto-url={protoUrl}>
        <p class="aid-proto-loading">Loading proto documentation...</p>
      </div>
      <noscript>
        <p>
          This reference needs JavaScript. <a href={protoUrl}>Read the .proto source</a>.
        </p>
      </noscript>
    </article>
  )
}
