export type ViewSourceProps = {
  declaration: string
}

export const ViewSource = ({ declaration }: ViewSourceProps) => (
  <details className="proto-view-source">
    <summary className="proto-view-source-toggle" />
    <pre className="proto-view-source-pre">
      <code>{declaration}</code>
    </pre>
  </details>
)
