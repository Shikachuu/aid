type ViewSourceProps = {
  declaration: string
}

/** Render a collapsed `<details>` block that shows a reconstructed `.proto` declaration. */
export const ViewSource = ({ declaration }: ViewSourceProps) => (
  <details className="proto-view-source">
    <summary className="proto-view-source-toggle" />
    <pre className="proto-view-source-pre">
      <code>{declaration}</code>
    </pre>
  </details>
)
