import type { BuildContext } from "../core/types"

/**
 * Resolve a named partial — preferring user overrides in
 * `${ctx.templatesDir}/<name>.tsx` and falling back to the bundled default
 * exported from `./components/<name>.tsx`.
 *
 * Stub. The real resolver dynamic-imports user paths so users get full Bun
 * runtime semantics (TSX, top-level await, etc.) inside their overrides.
 */
export async function resolvePartial<T>(
  _ctx: BuildContext,
  _name: string,
  fallback: T,
): Promise<T> {
  return fallback
}
