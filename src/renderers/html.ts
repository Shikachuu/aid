import type { RenderedPage, Route } from "../core/types"

/**
 * HTML passthrough — wraps source HTML in the site layout. Deferred from v0.1
 * (per plan), but the file exists so the route table doesn't error when an
 * .html file is encountered.
 *
 * Stub.
 */
export async function renderHtml(_route: Route): Promise<RenderedPage> {
  throw new Error("renderHtml(): deferred to v0.2")
}
