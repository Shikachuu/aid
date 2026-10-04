/** Render the "Open in AI" button that `attachAIButtons` binds in the browser. */
export function AIButton({ machineUrl }: { machineUrl: string }) {
  return (
    <div class="aid-ai-button" data-aid-ai-button data-machine-url={machineUrl}>
      <button type="button">Open in AI</button>
    </div>
  )
}
