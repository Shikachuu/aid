import type { RenderedPage, Route } from "../../core/types"

/**
 * Render a `.proto` file through the native TSX proto renderer. Stub —
 * the full TSX component tree lives under ./components/.
 */
export async function renderProto(_route: Route): Promise<RenderedPage> {
  throw new Error("renderProto(): not implemented")
}
