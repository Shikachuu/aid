type DeclarationSummaryProps = {
  declaration: string
}

export const DeclarationSummary = ({ declaration }: DeclarationSummaryProps) => (
  <details className="proto-view-source">
    <summary className="proto-view-source-toggle" />
    <pre className="proto-view-source-pre">
      <code>{declaration}</code>
    </pre>
  </details>
)
