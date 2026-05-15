import { useState } from "react"

export type ViewSourceProps = {
  declaration: string
}

export const ViewSource = ({ declaration }: ViewSourceProps) => {
  const [open, setOpen] = useState(false)
  return (
    <div className="proto-view-source">
      <button
        type="button"
        className="proto-view-source-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? "Hide source" : "View source"}
      </button>
      {open ? (
        <pre className="proto-view-source-pre">
          <code>{declaration}</code>
        </pre>
      ) : null}
    </div>
  )
}
