import type { BuildContext, Route } from "./types"

/**
 * Walk the content tree and produce a list of Routes.
 * Skips paths whose any segment starts with `_` (excluded per PRODUCT_OVERVIEW §4.2).
 *
 * Stub — implementation lands in the routing PR.
 */
export async function buildRoutes(_ctx: BuildContext): Promise<Route[]> {
  return []
}
