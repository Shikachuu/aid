import { createRoot } from "react-dom/client"
import { ProtoReference, type ProtoReferenceProps } from "./components/ProtoReference"

/**
 * Mount a `<ProtoReference/>` instance into the given DOM element. Returns an
 * `unmount` function. Used by aid's web entry to hydrate the SSR shell on
 * proto pages; third-party consumers can use it the same way for vanilla
 * (non-React) host apps.
 */
export const createProtoReference = (
  mount: Element,
  options: ProtoReferenceProps,
): (() => void) => {
  const root = createRoot(mount)
  root.render(<ProtoReference {...options} />)
  return () => root.unmount()
}
