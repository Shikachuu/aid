import { createRoot } from "react-dom/client"
import { ProtoReference, type ProtoReferenceProps } from "./components/ProtoReference"

/**
 * Render `<ProtoReference/>` into `mount` with a new React root, replacing its children. Returns a
 * function that unmounts it. Use it from pages that are not React apps.
 */
export const createProtoReference = (
  mount: Element,
  options: ProtoReferenceProps,
): (() => void) => {
  const root = createRoot(mount)
  root.render(<ProtoReference {...options} />)
  return () => root.unmount()
}
